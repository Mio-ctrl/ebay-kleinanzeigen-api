from urllib.parse import urlencode
from fastapi import HTTPException
from utils.browser import PlaywrightManager

def build_kleinanzeigen_url(category_id, location_id, plz, radius, sort=None, category_slug="multimedia-elektronik"):
    if not all([category_id, location_id, plz, radius]):
        return None

    url = f"https://www.kleinanzeigen.de/s-{category_slug}/{plz}/"
    if sort == "preis":
        url += "sortierung:preis/"
    url += f"{category_id}{location_id}r{radius}"
    return url


async def get_inserate_klaz(
    browser_manager,
    query,
    plz,
    radius,
    min_price,
    max_price,
    page_count,
    category_id=None,
    location_id=None,
    sort=None
):
    base_url = build_kleinanzeigen_url(category_id, location_id, plz, radius, sort)

    if base_url is None:
        raise HTTPException(status_code=400, detail="Ungültige URL-Parameter: category_id, location_id, plz oder radius fehlen.")

    params = {}
    if query:
        params['keywords'] = query
    if min_price is not None:
        params['price_from'] = min_price
    if max_price is not None:
        params['price_to'] = max_price

    results = []
    page = await browser_manager.new_context_page()
    try:
        for i in range(1, page_count + 1):
            full_url = base_url + f"/s-seite:{i}"
            if params:
                full_url += "?" + urlencode(params)

            await page.goto(full_url, timeout=120000)
            await page.wait_for_load_state("networkidle")

            page_results = await get_ads(page)
            results.extend(page_results)
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        await browser_manager.close_page(page)


async def get_ads(page):
    try:
        items = await page.query_selector_all(".ad-listitem:not(.is-topad):not(.badge-hint-pro-small-srp)")
        results = []
        for item in items:
            article = await item.query_selector("article")
            if article:
                data_adid = await article.get_attribute("data-adid")
                data_href = await article.get_attribute("data-href")
                # Get title from h2 element
                title_element = await article.query_selector("h2.text-module-begin a.ellipsis")
                title_text = await title_element.inner_text() if title_element else ""
                # Get price and description
                price = await article.query_selector("p.aditem-main--middle--price-shipping--price")
                # strip € and VB and strip whitespace
                price_text = await price.inner_text() if price else ""
                price_text = price_text.replace("€", "").replace("VB", "").replace(".", "").strip()
                description = await article.query_selector("p.aditem-main--middle--description")
                description_text = await description.inner_text() if description else ""
                if data_adid and data_href:
                    data_href = f"https://www.kleinanzeigen.de{data_href}"
                    results.append({"adid": data_adid, "url": data_href, "title": title_text, "price": price_text, "description": description_text})
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
