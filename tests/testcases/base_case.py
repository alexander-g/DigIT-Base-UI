import os, threading, time

from seleniumbase import config, BaseCase as SeleniumBaseCase
import pyppeteer as pyp
import asyncio

from backend.app import App

class BaseCase(SeleniumBaseCase):
    def setUp(self):
        config.remote_debug = True #enable chrome remote debugging port 9222
        super().setUp()
        if self.is_chromium():
            self._pyppeteer_page = start_codecoverage()
    
    def tearDown(self):
        if self.is_chromium():
            coverage   = retrieve_codecoverage(self._pyppeteer_page)
            import json, os
            outputfile = os.path.join(self.log_abspath, 'coverage_js/raw', f'{self.test_id}.codecoverage.json')
            os.makedirs(os.path.dirname(outputfile), exist_ok=True)
            open(outputfile,'w').write(json.dumps(coverage))
            import subprocess
            subprocess.call('killall chrome chromium', shell=True, timeout=5)
        self.driver.quit()
    
    def open_main(self, static=True):
        if static:
            return self.open(f"file://{os.environ['STATIC_PATH']}/index.html")
        else:
            self.port = self.start_flask()
            return self.open(f"http://localhost:{self.port}/")
    
    def start_flask(self):
        port = int(time.time()*100)%50000 + 10000
        print('Starting server on port ',port)
        t    = threading.Thread(target=lambda: App().run(debug=False, port=port, parse_args=False), daemon=True)
        t.start()
        return port




def start_codecoverage():
    import asyncio
    import pyppeteer as pyp

    async def request_coverage_recording():
        browser    = await pyp.connect(browserURL="http://localhost:9222")
        pages      = await browser.pages()
        assert len(pages) == 1, NotImplemented
        page       = pages[0]
        await page.coverage.startJSCoverage()
        return page
    return asyncio.get_event_loop().run_until_complete(request_coverage_recording())

def retrieve_codecoverage(pyppeteer_page):
    import asyncio

    async def retrieve():
        return await pyppeteer_page.coverage.stopJSCoverage()
    return asyncio.get_event_loop().run_until_complete(retrieve())
