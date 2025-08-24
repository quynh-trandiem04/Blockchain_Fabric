{
    'name': 'Library Management', # Tên hiển thị của module
    'version': '1.0',
    'summary': 'A simple module to manage books',
    'author': 'Quynh Thu',
    'category': 'Services',
    'depends': ['base'], # Module này phụ thuộc vào module 'base' của Odoo
    'data': [
        # Các file XML chứa dữ liệu và giao diện sẽ được nạp theo thứ tự
        'security/security.xml',
        'views/book_views.xml',
        'views/menus.xml',
    ],
    'application': True,
    'installable': True,
}