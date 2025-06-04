from fastapi import APIRouter, Query

from scrapers.inserate import get_inserate_klaz
from utils.browser import PlaywrightManager

router = APIRouter()


@router.get("/inserate")
async def get_inserate(
    query: str = Query(None),
    plz: str = Query(None, description="Postleitzahl wie '10115'"),
    radius: int = Query(None),
    min_price: int = Query(None),
    max_price: int = Query(None),
    page_count: int = Query(1, ge=1, le=20),
    category_id: str = Query(None, description="Kategorie-ID wie 'c161'"),
    location_id: str = Query(None, description="Location-ID wie 'l3843'"),
    sort: str = Query(None, description="Sortierung, z.B. 'preis'")
):
    browser_manager = PlaywrightManager()
    await browser_manager.start()
    try:
        results = await get_inserate_klaz(
            browser_manager, query, location, radius,
            min_price, max_price, page_count,
            category_id, location_id, sort
        )
        return {"success": True, "data": results}
    finally:
        await browser_manager.close()
