import { pageShell } from './layout';

// Simple inline SVG leaf decoration
const LEAF_SVG = `<svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" style="opacity:0.4; margin-top: 24px;">
  <path d="M40 70 C20 60, 8 40, 12 18 C28 22, 44 30, 50 48 C54 36, 52 20, 40 10 C60 14, 72 34, 68 56 C60 66, 50 72, 40 70Z" fill="none" stroke="var(--grain-outline)" stroke-width="1.5"/>
  <path d="M40 70 C40 50, 38 30, 40 10" fill="none" stroke="var(--grain-outline)" stroke-width="1"/>
</svg>`;

// Inline Google "G" logo SVG
const GOOGLE_ICON = `<svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" style="flex-shrink:0;">
  <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
  <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
  <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
  <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
</svg>`;

export function loginPage(): string {
  const body = `
<div style="display: flex; height: 100vh;">

  <!-- Left panel: 60% — logo + tagline -->
  <div style="
    flex: 0 0 60%;
    background-color: var(--bg);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 48px;
    position: relative;
  ">
    <img src="/oatPut_logo.png" alt="Oatput" style="width: 220px; margin-bottom: 24px;">
    <p style="
      color: var(--taupe);
      font-size: 1rem;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      margin: 0;
    ">Meeting to action. Amplified.</p>
    ${LEAF_SVG}
  </div>

  <!-- Right panel: 40% — sign in -->
  <div style="
    flex: 0 0 40%;
    background-color: #fffdf8;
    border-left: 1px solid var(--grain-outline);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 48px;
  ">
    <p style="
      color: var(--text);
      font-size: 0.75rem;
      letter-spacing: 0.25em;
      text-transform: uppercase;
      margin: 0 0 32px;
    ">Welcome back</p>

    <a href="/auth/google" style="
      display: inline-flex;
      align-items: center;
      gap: 10px;
      background-color: var(--grain);
      color: var(--text);
      border: 1px solid var(--grain-outline);
      padding: 12px 24px;
      border-radius: 4px;
      text-decoration: none;
      font-size: 0.95rem;
      font-weight: 500;
      letter-spacing: 0.1em;
      transition: opacity 0.15s;
    " onmouseover="this.style.opacity='0.85'" onmouseout="this.style.opacity='1'">
      ${GOOGLE_ICON}
      Sign in with Google
    </a>
  </div>

</div>`;

  return pageShell('Oatput — Sign In', body);
}
