from django.http import JsonResponse
class PrivateAPIMiddleware:
    def __init__(self,get_response): self.get_response=get_response
    def __call__(self,request):
        if request.path.startswith('/api/v1/') and int(request.META.get('CONTENT_LENGTH') or 0)>32*1024*1024:
            response=JsonResponse({'error':{'code':'too_large','message':'資料超過 32 MB 限制。'}},status=413)
        else:
            response=self.get_response(request)
        if request.path.startswith('/api/v1/'):
            if response.status_code==404 and not response.get('Content-Type','').startswith('application/json'):
                response=JsonResponse({'error':{'code':'not_found','message':'找不到資料。'}},status=404)
            response['Cache-Control']='private, no-store'
            response['Vary']='Cookie'
        return response
