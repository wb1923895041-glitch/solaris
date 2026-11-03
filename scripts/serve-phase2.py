from pathlib import Path
from functools import partial
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
import sys,webbrowser
r=Path(__file__).resolve().parent.parent;dist=r/'dist'
if not (dist/'index.html').exists():raise SystemExit('Run npm ci and npm run build first, or use the acceptance package with prebuilt dist.')
address='http://127.0.0.1:4175/'
try:server=ThreadingHTTPServer(('127.0.0.1',4175),partial(SimpleHTTPRequestHandler,directory=str(dist)))
except OSError as e:raise SystemExit('Port 4175 is in use. Open '+address+' or stop that server. '+str(e))
print('SOLARIS: '+address,flush=True)
if '--no-open' not in sys.argv:webbrowser.open(address)
try:server.serve_forever()
except KeyboardInterrupt:server.server_close()
