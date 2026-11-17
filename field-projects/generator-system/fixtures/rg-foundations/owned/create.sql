INSERT INTO p_items_api_owner.items(id) VALUES($1) RETURNING current_user='pr_items_db__items_api' AS product_role;
