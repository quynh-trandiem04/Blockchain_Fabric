from odoo import http

class SimpleController(http.Controller):
    @http.route('/library/hello', auth='public', website=True)
    def hello(self, **kw):
        return http.Response("Hello, Blockchain Project!")