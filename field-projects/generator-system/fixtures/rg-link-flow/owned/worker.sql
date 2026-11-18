UPDATE p_items_api_owner.items SET marked=true WHERE id=$1 RETURNING id,marked;
