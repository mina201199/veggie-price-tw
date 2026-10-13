"""GPS map assets must work through the phone app's existing static file route."""
from django.test import SimpleTestCase


class GPSMapFilesTests(SimpleTestCase):
    def test_map_views_allow_same_origin_app_embedding(self):
        for filename in ('gps-world.html', 'taiwan-map.html', 'prices.html'):
            with self.subTest(filename=filename):
                response = self.client.get('/app/' + filename)
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.headers.get('X-Frame-Options'), 'SAMEORIGIN')
                response.close()

    def test_coverage_json_is_available_without_login(self):
        response = self.client.get('/app/taiwan-counties.json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers['Content-Type'], 'application/json')
        response.close()
