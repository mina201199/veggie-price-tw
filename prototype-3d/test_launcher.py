import importlib.util, pathlib, threading, unittest, urllib.request, urllib.error
ROOT=pathlib.Path(__file__).resolve().parent.parent
class LauncherTests(unittest.TestCase):
 def test_serves_only_prototype_and_rejects_busy_port(self):
  self.assertTrue((ROOT/'start_app.py').exists(), 'portable launcher must exist')
  spec=importlib.util.spec_from_file_location('start_app',ROOT/'start_app.py');app=importlib.util.module_from_spec(spec);spec.loader.exec_module(app)
  server=app.make_server(0);thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
  try:
   port=server.server_address[1]
   for page in ['prices.html','notebook.html','index.html']:
    with urllib.request.urlopen(f'http://127.0.0.1:{port}/{page}') as response:self.assertEqual(response.status,200)
   with self.assertRaises(urllib.error.HTTPError):urllib.request.urlopen(f'http://127.0.0.1:{port}/../.git/config')
   with self.assertRaises(OSError):app.make_server(port)
  finally:server.shutdown();server.server_close();thread.join()
if __name__=='__main__':unittest.main()
