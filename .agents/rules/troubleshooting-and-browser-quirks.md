# Troubleshooting & Known Browser Quirks

## 1. Chrome Extension Message Channel Error
If the user or console reports an error matching:
> `Uncaught (in promise) Error: A listener indicated an asynchronous response by returning true, but the message channel closed before a response was received`
(often attributed to `<poId>:1` or occurring right after fetching listing photos/data):

* **Context & Root Cause**: This is an external Chrome browser extension artifact (commonly shopping/coupon extensions like Honey or Rakuten, password managers like 1Password/Bitwarden, or ad blockers). When the app triggers a `fetch` request for external listing URLs (e.g. ShopGoodwill or eBay), the extension's content script attempts to inspect the URL and messages its background worker. When that worker times out or drops the connection, Chrome logs this error at Line 1 of the document.
* **Application Impact**: Zero impact. It is completely isolated from Resale Command, Vue, Astro, Appwrite database, and media storage.
* **Agent Directive**: Whenever the user mentions this error, immediately recognize it as the known browser extension quirk documented here, reassure the user that it does not disrupt data or image saving, and confirm the actual feature operation succeeded.
