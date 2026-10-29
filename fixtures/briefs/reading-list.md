# Reading list

A small personal app for saving articles to read later.

## What it does

- Save an article: a URL (required) and an optional title. If the title is empty, use the URL.
- List saved articles, newest first, showing title, URL, and whether it has been read.
- Mark an article as read or unread.
- Delete an article.
- Show a count of unread articles at the top of the page.

## Shape

- One backend service with a REST API and its own PostgreSQL database.
- One web frontend that calls the API through a typed client.
- No accounts or login: it's a single-user local app.

## Rules

- URLs must start with http:// or https://; reject anything else with a 400.
- Saving the same URL twice returns the existing article instead of creating a duplicate.
