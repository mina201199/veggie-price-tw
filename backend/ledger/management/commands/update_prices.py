"""Stage price refreshes so failures never replace the last public snapshot."""
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone
from ledger.models import UpdateRun

def atomic_copy(source,target):
    # Stage alongside the destination: BACKEND_DATA_DIR may be a different volume.
    temporary=None
    try:
        with tempfile.NamedTemporaryFile(prefix='.price-',suffix='.tmp',dir=target.parent,delete=False) as output:
            temporary=Path(output.name)
            with source.open('rb') as content: shutil.copyfileobj(content,output)
            output.flush();os.fsync(output.fileno())
        os.replace(temporary,target)
    finally:
        if temporary: temporary.unlink(missing_ok=True)

class Command(BaseCommand):
    help='Refresh price sources and atomically publish a validated snapshot.'
    def add_arguments(self,parser):
        parser.add_argument('--skip-fetch',action='store_true',help='Build existing source files without network access.')
        parser.add_argument('--date',help='Optional analysis date YYYY-MM-DD.')
    def handle(self,*args,**options):
        root=settings.PROJECT_DIR
        runtime=settings.DATA_DIR
        runtime.mkdir(parents=True,exist_ok=True)
        lock=runtime/'prices-update.lock'
        try:
            descriptor=os.open(lock,os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o600)
        except FileExistsError:
            raise CommandError('Another price update is running. For a crashed process, verify it has stopped before removing prices-update.lock.')
        run=None
        try:
            os.write(descriptor,str(os.getpid()).encode())
            run=UpdateRun.objects.create()
            with tempfile.TemporaryDirectory(prefix='prices-stage-',dir=runtime) as temporary:
                stage=Path(temporary)
                shutil.copytree(root/'tools',stage/'tools',ignore=shutil.ignore_patterns('__pycache__'))
                sources=runtime/'prices-sources' if (runtime/'prices-sources').exists() else root/'data'
                if sources.exists(): shutil.copytree(sources,stage/'data')
                else: (stage/'data').mkdir()
                (stage/'prototype-3d').mkdir()
                commands=[]
                if not options['skip_fetch']:
                    commands.extend([[sys.executable,str(stage/'tools'/'fetch.py')],[sys.executable,str(stage/'tools'/'fetch_retail.py')]])
                build=[sys.executable,str(stage/'tools'/'build_prices.py')]
                if options.get('date'): build.append(options['date'])
                commands.append(build)
                for command in commands:
                    subprocess.run(command,cwd=stage,check=True,capture_output=True,text=True,timeout=1800)
                snapshot=stage/'prototype-3d'/'prices-data.json'
                document=json.loads(snapshot.read_text(encoding='utf-8'))
                if not isinstance(document,dict) or not isinstance(document.get('items'),list) or not document.get('latest'):
                    raise ValueError('Invalid generated snapshot')
                destination=runtime/'prices-data.json'
                destination.parent.mkdir(parents=True,exist_ok=True)
                # Persist fetched source files before publishing. Each file replacement is atomic.
                if not options['skip_fetch']:
                    for source in (stage/'data').rglob('*.json'):
                        target=runtime/'prices-sources'/source.relative_to(stage/'data')
                        target.parent.mkdir(parents=True,exist_ok=True)
                        atomic_copy(source,target)
                atomic_copy(snapshot,destination)
                run.success=True
                run.snapshot_date=str(document['latest'])[:40]
                run.summary='Snapshot published'
                self.stdout.write(self.style.SUCCESS('Price snapshot updated: '+run.snapshot_date))
        except Exception as exc:
            if run: run.summary='Update failed; previous snapshot preserved ('+type(exc).__name__+')'
            raise CommandError('Price update failed; the previous public snapshot is preserved.') from exc
        finally:
            if run:
                run.finished_at=timezone.now();run.save()
            os.close(descriptor)
            lock.unlink(missing_ok=True)
