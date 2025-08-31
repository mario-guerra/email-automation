import asyncio
from playwright.async_api import async_playwright
import requests
from bs4 import BeautifulSoup
import os
import urllib.parse
from urllib.parse import urljoin
import re
import mimetypes
import logging

def setup_logging(output_dir):
    logging.basicConfig(
        filename=os.path.join(output_dir, 'clone_log.txt'),
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s'
    )

async def fetch_rendered_html(url):
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        await page.goto(url, wait_until='networkidle', timeout=30000)  # Wait for JS to load
        html = await page.content()  # Get rendered HTML after JS execution
        await browser.close()
        return html

def download_resource(url, output_dir, headers, base_url):
    if not url or 'data:' in url or url.startswith('#'):
        return None
    try:
        parsed_url = urllib.parse.urlparse(url)
        if not parsed_url.scheme or not parsed_url.netloc:
            return None
        logging.info(f"Downloading resource: {url}")
        response = requests.get(url, headers=headers, timeout=3)
        response.raise_for_status()

        ext = mimetypes.guess_extension(response.headers.get('Content-Type', '')) or \
              os.path.splitext(parsed_url.path)[1] or '.bin'
        filename = re.sub(r'[^\w\-\.]', '_', os.path.basename(parsed_url.path)) or f"resource{ext}"
        local_path = os.path.join(output_dir, filename)

        with open(local_path, 'wb') as f:
            f.write(response.content)
        return os.path.basename(local_path)
    except Exception as e:
        logging.error(f"Failed to download resource {url}: {e}")
        return None

def process_css(css_content, css_url, output_dir, headers, base_url):
    logging.info(f"Processing CSS from: {css_url}")
    import_regex = re.compile(r'@import\s*(url\()?["\']?([^"\')]+)["\']?')
    for match in import_regex.finditer(css_content):
        import_url = urljoin(css_url, match.group(2))
        local_import = download_resource(import_url, output_dir, headers, base_url)
        if local_import:
            css_content = css_content.replace(match.group(0), f'@import "{local_import}"')

    url_regex = re.compile(r'url\s*\(\s*["\']?([^"\')]+)["\']?\s*\)')
    for match in url_regex.finditer(css_content):
        resource_url = match.group(1)
        if resource_url.startswith('data:') or resource_url.startswith('#'):
            continue
        resource_url = urljoin(css_url, resource_url)
        local_resource = download_resource(resource_url, output_dir, headers, base_url)
        if local_resource:
            css_content = css_content.replace(match.group(1), local_resource)

    return css_content

def clone_webpage(url, output_dir="cloned_webpage"):
    try:
        if not os.path.exists(output_dir):
            os.makedirs(output_dir)
        setup_logging(output_dir)

        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
        logging.info(f"Fetching rendered HTML for: {url}")
        rendered_html = asyncio.run(fetch_rendered_html(url))

        soup = BeautifulSoup(rendered_html, 'html.parser')

        # Process CSS files
        for link in soup.find_all('link', rel='stylesheet'):
            css_url = link.get('href')
            if css_url:
                css_url = urljoin(url, css_url)
                try:
                    css_response = requests.get(css_url, headers=headers, timeout=3)
                    processed_css = process_css(css_response.text, css_url, output_dir, headers, url)
                    css_filename = re.sub(r'[^\w\-\.]', '_', os.path.basename(urllib.parse.urlparse(css_url).path)) or 'styles.css'
                    css_path = os.path.join(output_dir, css_filename)
                    with open(css_path, 'w', encoding='utf-8') as f:
                        f.write(processed_css)
                    link['href'] = css_filename
                except Exception as e:
                    logging.error(f"Failed to process CSS {css_url}: {e}")

        # Process inline CSS
        for style in soup.find_all('style'):
            if style.string:
                style.string = process_css(style.string, url, output_dir, headers, url)

        # Download JS files
        for script in soup.find_all('script', src=True):
            js_url = script.get('src')
            if js_url:
                js_url = urljoin(url, js_url)
                local_js = download_resource(js_url, output_dir, headers, url)
                if local_js:
                    script['src'] = local_js

        # Download images
        for img in soup.find_all('img'):
            img_url = img.get('src') or img.get('srcset')
            if img_url:
                img_url = urljoin(url, img_url.split(',')[0].strip().split(' ')[0])
                local_img = download_resource(img_url, output_dir, headers, url)
                if local_img:
                    img['src'] = local_img

        # Handle other links (favicons, etc.)
        for link in soup.find_all('link'):
            href = link.get('href')
            if href and link.get('rel') in ['icon', 'shortcut icon', 'manifest', 'apple-touch-icon', 'stylesheet', 'preload', 'dns-prefetch', 'preconnect']:
                href = urljoin(url, href)
                local_file = download_resource(href, output_dir, headers, url)
                if local_file:
                    link['href'] = local_file

        # Save rendered HTML
        html_filename = os.path.join(output_dir, 'index.html')
        with open(html_filename, 'w', encoding='utf-8') as f:
            f.write(soup.prettify())

        print(f"Webpage cloned successfully to {output_dir}/index.html")
        logging.info(f"Webpage cloned successfully to {output_dir}/index.html")

    except Exception as e:
        print(f"Error: {e}")
        logging.error(f"Error: {e}")

if __name__ == "__main__":
    target_url = input("Enter the webpage URL to clone (e.g., https://example.com): ")
    clone_webpage(target_url)