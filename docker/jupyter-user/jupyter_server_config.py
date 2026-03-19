# Allow iframe embedding from Parthenon
c.ServerApp.tornado_settings = {
    "headers": {
        "Content-Security-Policy": "frame-ancestors 'self' https://parthenon.acumenus.net",
    }
}
