"""Only the fixed internal Caddy peer may provide client IP and HTTPS scheme."""
import ipaddress

def proxy_options(environment):
    trusted = environment.get('WAITRESS_TRUSTED_PROXY', '')
    try:
        ipaddress.ip_address(trusted)
    except ValueError as error:
        raise ValueError('WAITRESS_TRUSTED_PROXY must be the fixed Caddy IP, never a wildcard.') from error
    return {
        'trusted_proxy': trusted,
        'trusted_proxy_count': 1,
        'trusted_proxy_headers': {'x-forwarded-for', 'x-forwarded-proto'},
        'clear_untrusted_proxy_headers': True,
    }
