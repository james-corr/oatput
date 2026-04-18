const GTM_ID = 'GTM-MDD8QKSD';

const GTM_HEAD = `<!-- Google Tag Manager -->
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${GTM_ID}');</script>
<!-- End Google Tag Manager -->`;

const GTM_NOSCRIPT = `<!-- Google Tag Manager (noscript) -->
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${GTM_ID}"
height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
<!-- End Google Tag Manager (noscript) -->`;

const CSS_VARS = `
<style>
  :root {
    --bg: #f9f5ed;
    --text: #3d3320;
    --wordmark-tan: #e8dfc8;
    --grain: #d4ba7a;
    --grain-outline: #9a7b3a;
    --leaf: #6d8c3a;
    --taupe: #8c7d5a;
  }
  * { box-sizing: border-box; }
  html, body { height: 100%; margin: 0; }
  body {
    font-family: 'EB Garamond', Georgia, serif;
    letter-spacing: 0.12em;
    background-color: var(--bg);
    color: var(--text);
  }
  input, select, button, a {
    font-family: 'EB Garamond', Georgia, serif;
    letter-spacing: 0.1em;
  }
  input:focus, select:focus {
    outline: none;
    border-color: var(--grain-outline) !important;
    box-shadow: 0 0 0 2px rgba(154,123,58,0.2);
  }
</style>`;

const TAILWIND_CONFIG = `<script>
  tailwind.config = {
    theme: {
      extend: {
        colors: {
          'bg': '#f9f5ed',
          'text-primary': '#3d3320',
          'wordmark-tan': '#e8dfc8',
          'grain': '#d4ba7a',
          'grain-outline': '#9a7b3a',
          'leaf': '#6d8c3a',
          'taupe': '#8c7d5a',
        },
        fontFamily: {
          serif: ['"EB Garamond"', 'Georgia', 'serif'],
        }
      }
    }
  }
</script>`;

export function pageShell(title: string, body: string, headExtra = ''): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=EB+Garamond:wght@400;500&display=swap" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
  ${TAILWIND_CONFIG}
  ${CSS_VARS}
  ${GTM_HEAD}
  ${headExtra}
</head>
<body>
${GTM_NOSCRIPT}
${body}
</body>
</html>`;
}

export function sidebar(email: string, activePage: 'dashboard' | 'settings'): string {
  const link = (href: string, label: string, page: 'dashboard' | 'settings') => {
    const isActive = activePage === page;
    const color = isActive ? 'color: var(--grain); font-weight: 500;' : 'color: var(--text);';
    return `<a href="${href}" style="${color} text-decoration: none; display: block; padding: 6px 0; font-size: 0.9rem;">${label}</a>`;
  };

  return `<div style="
    position: fixed; top: 0; left: 0; bottom: 0; width: 160px;
    background-color: var(--bg);
    border-right: 1px solid var(--grain-outline);
    display: flex; flex-direction: column;
    padding: 24px 20px;
    z-index: 10;
  ">
    <div style="margin-bottom: 28px;">
      <img src="/output_logo.png" alt="Output" style="width: 80px; display: block;">
    </div>
    <nav style="flex: 1; display: flex; flex-direction: column; gap: 4px;">
      ${link('/dashboard', 'Dashboard', 'dashboard')}
      ${link('/settings', 'Settings', 'settings')}
    </nav>
    <div style="margin-top: auto; border-top: 1px solid var(--grain-outline); padding-top: 16px;">
      <p style="color: var(--taupe); font-size: 0.75rem; margin: 0 0 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; letter-spacing: 0.05em;">${email}</p>
      <a href="/auth/logout" style="color: var(--taupe); font-size: 0.8rem; text-decoration: none;">Sign out</a>
    </div>
  </div>`;
}
