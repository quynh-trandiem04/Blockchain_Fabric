{
    "name": "Blockchain Payments (MetaMask)",
    "version": "17.0.1.0.1",
    "summary": "Custom payment provider via MetaMask on Ethereum/Ganache",
    "author": "You",
    "depends": ["payment", "website_sale", "website"],
    "data": [
        "security/ir.model.access.csv",
        "data/payment_provider_data.xml",
        "views/payment_provider_views.xml",
        "views/payment_templates.xml",
        "views/website_checkout_templates_simple.xml",
    ],
    "assets": {
        "web.assets_frontend": [
            "payment_blockchain/static/src/js/blockchain_provider.js",
            "payment_blockchain/static/src/js/global_blockchain.js",
            "payment_blockchain/static/src/js/blockchain_simulator.js",
        ],
    },
    "installable": True,
    "application": True,

}
