import {
  createOrder,
  fetchBanners,
  fetchCategories,
  fetchOrderByInvoice,
  fetchProductById,
  fetchProducts,
  fetchSiteSettings,
  fetchTestimonials,
  filterAndSortProducts,
  formatDate,
  formatIDR,
  toJsDate,
  getLastInvoiceFromStorage,
  getParam,
  isFirebaseConfigured
} from "./store.js";

const page = document.body.dataset.page;
const isInsidePages = window.location.pathname.includes("/pages/");
const pagePrefix = isInsidePages ? "" : "pages/";
const rootPrefix = isInsidePages ? "../" : "./";
const ADMIN_WHATSAPP = "6283867095957";
const TELEGRAM_ADMIN = "https://t.me/pinnlyy";
const WA_CHANNEL = "https://whatsapp.com/channel/0029VbBG7WZ4SpkArJmOjD3u";
const STORE_NAME = "Pinnly Store";
const qs = (s, p = document) => p.querySelector(s);
const qsa = (s, p = document) => [...p.querySelectorAll(s)];

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function productDetailUrl(id) { return `${pagePrefix}detail-produk.html?id=${encodeURIComponent(id)}`; }
function checkoutUrl(id) { return `${pagePrefix}checkout.html?id=${encodeURIComponent(id)}`; }
function cartUrl() { return `${pagePrefix}keranjang.html`; }
function invoiceUrl(invoice) { return `${pagePrefix}invoice.html?invoice=${encodeURIComponent(invoice)}`; }

function stockClass(status = "") {
  const text = status.toLowerCase();
  if (text.includes("habis") || text.includes("kosong") || text.includes("sold")) return "empty";
  if (text.includes("limit") || text.includes("terbatas")) return "limited";
  return "ready";
}
function statusClass(status = "") {
  const text = status.toLowerCase();
  if (text.includes("success") || text.includes("paid")) return "success";
  if (text.includes("cancel") || text.includes("failed")) return "cancelled";
  if (text.includes("process") || text.includes("proses")) return "process";
  return "pending";
}
function getProductBadge(product, index = 0) {
  const manualBadge = String(product.badge || "").trim();
  if (manualBadge) return manualBadge.toUpperCase();
  if (product.discountPercent > 0 || product.oldPrice > product.price) return "SALE";
  if (product.hot || product.soldCount >= 10) return "HOT";
  const created = toJsDate(product.createdAt);
  if (created && (Date.now() - created.getTime()) / 86400000 <= 14) return "NEW";
  return index < 2 ? (index === 0 ? "HOT" : "NEW") : "";
}
function imageMarkup(product, cls = "product-image") {
  if (product.imageUrl) return `<div class="${cls} has-img"><img src="${escapeHtml(product.imageUrl)}" alt="${escapeHtml(product.name)}" loading="lazy"></div>`;
  return `<div class="${cls}">${escapeHtml(product.imageText || "PINNLY")}</div>`;
}
function priceMarkup(product) {
  const hasOld = product.oldPrice && product.oldPrice > product.price;
  const disc = product.discountPercent || (hasOld ? Math.round((1 - product.price / product.oldPrice) * 100) : 0);
  return `<div class="price-stack"><span class="price">${formatIDR(product.price)}</span>${hasOld ? `<small class="old-price">${formatIDR(product.oldPrice)}</small>` : ""}${disc ? `<small class="discount-label">Hemat ${disc}%</small>` : ""}</div>`;
}
function showToast(text) {
  let toast = qs("#appToast");
  if (!toast) { toast = document.createElement("div"); toast.id = "appToast"; toast.className = "app-toast"; document.body.appendChild(toast); }
  toast.textContent = text; toast.classList.add("show"); setTimeout(() => toast.classList.remove("show"), 3200);
}

function getCart() { try { return JSON.parse(localStorage.getItem("pinnly_cart") || "[]"); } catch { return []; } }
function saveCart(cart) { localStorage.setItem("pinnly_cart", JSON.stringify(cart)); updateCartBadge(); }
function addToCart(product) {
  const cart = getCart();
  const exists = cart.find((item) => item.id === product.id);
  if (exists) exists.qty += 1;
  else cart.push({ id: product.id, name: product.name, price: product.price, categoryName: product.categoryName, imageText: product.imageText, imageUrl: product.imageUrl, qty: 1 });
  saveCart(cart); showToast("Produk masuk keranjang");
}
function removeFromCart(id) { saveCart(getCart().filter((item) => item.id !== id)); initCartPage(); }
function cartTotal(cart = getCart()) { return cart.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.qty || 1), 0); }
function updateCartBadge() {
  const count = getCart().reduce((sum, item) => sum + Number(item.qty || 1), 0);
  qsa("[data-cart-count]").forEach((el) => el.textContent = count);
}

function setupCommonUI() {
  const year = qs("#yearNow"); if (year) year.textContent = new Date().getFullYear();
  const menuToggle = qs("#menuToggle"); const navLinks = qs("#navLinks");
  if (menuToggle && navLinks) menuToggle.addEventListener("click", () => navLinks.classList.toggle("show"));
  injectBottomNavigation(); injectThemeToggle(); updateCartBadge();
  document.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-add-cart]");
    if (btn) {
      const id = btn.dataset.addCart;
      try { const product = await fetchProductById(id); if (product) addToCart(product); }
      catch { showToast("Gagal menambah keranjang"); }
    }
    const copy = e.target.closest("[data-copy]");
    if (copy) { navigator.clipboard?.writeText(copy.dataset.copy); showToast("Disalin"); }
    const rem = e.target.closest("[data-remove-cart]");
    if (rem) removeFromCart(rem.dataset.removeCart);
  });
}
function injectThemeToggle() {
  if (!qs(".theme-toggle")) {
    const btn = document.createElement("button"); btn.className = "theme-toggle"; btn.type = "button"; btn.textContent = localStorage.getItem("pinnly_theme") === "light" ? "🌙" : "☀️";
    qs(".navbar")?.appendChild(btn);
    btn.addEventListener("click", () => { const light = document.body.classList.toggle("light-theme"); localStorage.setItem("pinnly_theme", light ? "light" : "dark"); btn.textContent = light ? "🌙" : "☀️"; });
  }
  if (localStorage.getItem("pinnly_theme") === "light") document.body.classList.add("light-theme");
}
function injectBottomNavigation() {
  if (qs(".bottom-nav")) return;
  const pagesPrefix = isInsidePages ? "./" : "./pages/";
  const items = [
    { key: "home", icon: "🏠", label: "Home", href: `${rootPrefix}index.html` },
    { key: "products", icon: "🛍️", label: "Produk", href: `${pagesPrefix}produk.html` },
    { key: "cart", icon: "🛒", label: "Keranjang", href: `${pagesPrefix}keranjang.html`, badge: true },
    { key: "invoice", icon: "🧾", label: "Invoice", href: `${pagesPrefix}invoice.html` },
    { key: "contact", icon: "💬", label: "Info", href: `${pagesPrefix}kontak.html` }
  ];
  const nav = document.createElement("nav"); nav.className = "bottom-nav";
  nav.innerHTML = items.map((it) => `<a class="${it.key === page || ((page === "detail" || page === "checkout") && it.key === "products") ? "active" : ""}" href="${it.href}"><span>${it.icon}</span>${it.label}${it.badge ? '<b data-cart-count>0</b>' : ""}</a>`).join("");
  document.body.appendChild(nav);
}

async function loadDynamicWebContent() {
  if (!isFirebaseConfigured) return;
  try {
    const [settings, banners, testimonials] = await Promise.all([
      fetchSiteSettings(),
      fetchBanners(),
      fetchTestimonials()
    ]);

    if (settings.logoUrl) {
      qsa(".brand-logo-img, .profile-avatar img").forEach((img) => {
        img.src = settings.logoUrl;
      });
    }

    if (banners.length) {
      const banner = banners[0];
      qsa(".profile-cover img").forEach((img) => {
        img.src = banner.imageUrl;
        img.alt = banner.title || "Banner Pinnly Store";
      });
    }

    const testiGrid = qs("#testimonialGrid");
    if (testiGrid && testimonials.length) {
      testiGrid.innerHTML = testimonials.slice(0, 6).map((item) => `
        <article class="testimonial-card glass-card testimonial-photo-card">
          ${item.imageUrl ? `<img src="${escapeHtml(item.imageUrl)}" alt="Testimoni Pinnly Store" loading="lazy">` : ""}
          <strong>${escapeHtml(item.title || "Testimoni")}</strong>
          <p>${escapeHtml(item.text || "Terima kasih sudah order di Pinnly Store.")}</p>
        </article>
      `).join("");
    }
  } catch (err) {
    console.error("Gagal memuat konten dinamis:", err);
  }
}

function renderConfigWarning(container) {
  if (!container || isFirebaseConfigured) return false;
  container.innerHTML = `<div class="error-state glass-card"><h3>Firebase belum dikonfigurasi</h3><p>Isi data Firebase Web App di <code>js/firebase-config.js</code>, lalu refresh halaman.</p></div>`;
  return true;
}
function renderProductCards(container, products, { limit = null } = {}) {
  if (!container) return; const list = typeof limit === "number" ? products.slice(0, limit) : products;
  if (!list.length) { container.innerHTML = `<div class="empty-state glass-card"><h3>Produk belum ada</h3><p>Produk sedang disiapkan. Cek lagi nanti atau chat admin.</p></div>`; return; }
  container.innerHTML = list.map((p, i) => { const badge = getProductBadge(p, i); return `
    <article class="product-card glass-card fade-up" style="--delay:${Math.min(i, 8) * 70}ms">
      ${badge ? `<span class="auto-badge ${badge.toLowerCase()}">${escapeHtml(badge)}</span>` : ""}
      ${imageMarkup(p)}
      <div class="product-body">
        <div class="product-top"><span class="category-pill">${escapeHtml(p.categoryName)}</span><span class="stock-badge ${stockClass(p.stockStatus)}">${escapeHtml(p.stockStatus)}</span></div>
        <h3 class="product-title">${escapeHtml(p.name)}</h3><p class="product-desc">${escapeHtml(p.shortDescription)}</p>
        <div class="product-footer">${priceMarkup(p)}<div class="product-actions"><a class="btn btn-secondary" href="${productDetailUrl(p.id)}">Detail</a><button class="btn btn-primary" type="button" data-add-cart="${escapeHtml(p.id)}">+ Cart</button></div></div>
      </div>
    </article>`; }).join("");
}

async function initHomePage() {
  const pc = qs("#homeProducts"), cc = qs("#homeCategories"); if (renderConfigWarning(pc)) return;
  try {
    const [products, categories] = await Promise.all([fetchProducts(), fetchCategories()]);
    qs("#statProducts") && (qs("#statProducts").textContent = `${products.length}+`); qs("#statCategories") && (qs("#statCategories").textContent = `${categories.length}+`);
    if (cc) cc.innerHTML = categories.length ? categories.map(c => `<a class="category-pill" href="${pagePrefix}produk.html?category=${encodeURIComponent(c.name)}"><strong>${escapeHtml(c.name)}</strong>${c.productCount || 0} produk</a>`).join("") : `<div class="empty-state glass-card"><p>Kategori belum tersedia.</p></div>`;
    renderProductCards(pc, products, { limit: 6 });
  } catch (e) { console.error(e); pc.innerHTML = `<div class="error-state glass-card"><h3>Gagal memuat produk</h3><p>${escapeHtml(e.message)}</p></div>`; }
}
async function initProductsPage() {
  const grid = qs("#productGrid"), search = qs("#searchInput"), cat = qs("#categoryFilter"), sort = qs("#sortSelect"), counter = qs("#productCounter"); if (renderConfigWarning(grid)) return;
  try {
    const [products, categories] = await Promise.all([fetchProducts(), fetchCategories()]);
    if (cat) { cat.innerHTML = `<option value="all">Semua kategori</option>` + categories.map(c => `<option value="${escapeHtml(c.name)}">${escapeHtml(c.name)}</option>`).join(""); const cu = getParam("category"); if (cu) cat.value = cu; }
    const update = () => { const res = filterAndSortProducts(products, { search: search?.value || "", category: cat?.value || "all", sort: sort?.value || "newest" }); renderProductCards(grid, res); if (counter) counter.textContent = `${res.length} produk ditemukan`; };
    search?.addEventListener("input", update); cat?.addEventListener("change", update); sort?.addEventListener("change", update); qs("#resetFilterBtn")?.addEventListener("click", () => { if(search) search.value=""; if(cat) cat.value="all"; if(sort) sort.value="newest"; update(); }); update();
  } catch (e) { console.error(e); grid.innerHTML = `<div class="error-state glass-card"><h3>Gagal memuat katalog</h3><p>${escapeHtml(e.message)}</p></div>`; }
}
async function initDetailPage() {
  const w = qs("#detailWrapper"), id = getParam("id"); if (!id) { w.innerHTML = `<div class="error-state glass-card"><h3>Produk tidak ditemukan</h3></div>`; return; } if (renderConfigWarning(w)) return;
  try { const p = await fetchProductById(id); if (!p) { w.innerHTML = `<div class="error-state glass-card"><h3>Produk tidak ditemukan</h3></div>`; return; }
    const features = p.features.length ? p.features.map(f => `<li>${escapeHtml(f)}</li>`).join("") : `<li>Produk digital siap dikirim setelah pembayaran dikonfirmasi.</li>`;
    w.innerHTML = `<div class="glass-card detail-media">${imageMarkup(p, "detail-image")}</div><article class="glass-card detail-info"><p class="eyebrow">${escapeHtml(p.categoryName)}</p><h1>${escapeHtml(p.name)}</h1><p class="detail-description">${escapeHtml(p.description)}</p><div class="detail-meta">${priceMarkup(p)}<span class="stock-badge ${stockClass(p.stockStatus)}">${escapeHtml(p.stockStatus)}</span></div><h3>Fitur produk</h3><ul class="feature-list">${features}</ul>${p.notes ? `<div class="notes-box"><strong>Catatan:</strong><br>${escapeHtml(p.notes)}</div>` : ""}<div class="hero-actions"><button class="btn btn-primary" data-add-cart="${escapeHtml(p.id)}">Tambah Keranjang</button><a class="btn btn-secondary" href="${checkoutUrl(p.id)}">Checkout Langsung</a></div></article>`;
  } catch(e){ w.innerHTML = `<div class="error-state glass-card"><h3>Gagal memuat detail</h3><p>${escapeHtml(e.message)}</p></div>`; }
}
async function initCheckoutPage() {
  const id = getParam("id"), summary = qs("#checkoutProductCard"), form = qs("#checkoutForm"), msg = qs("#checkoutMessage"), submit = qs("#checkoutSubmit"); if (renderConfigWarning(summary)) return;
  let product = null, isCart = !id;
  try {
    if (id) product = await fetchProductById(id); else { const cart = getCart(); if (cart.length) product = { id: "cart", name: cart.map(i => `${i.name} x${i.qty}`).join(", "), categoryName: "Keranjang", price: cartTotal(cart), stockStatus: "Ready", shortDescription: `${cart.length} item dalam keranjang`, description: "Checkout dari keranjang", imageText: "🛒" }; }
    if (!product) { summary.innerHTML = `<div class="error-state"><h3>Keranjang kosong</h3><p>Pilih produk dulu sebelum checkout.</p><a class="btn btn-primary" href="./produk.html">Lihat Produk</a></div>`; form?.querySelectorAll("input,select,button").forEach(f => f.disabled = true); return; }
    summary.innerHTML = `${imageMarkup(product, "product-image summary-image")}<span class="category-pill">${escapeHtml(product.categoryName)}</span><h2>${escapeHtml(product.name)}</h2><p>${escapeHtml(product.shortDescription)}</p><div class="invoice-total"><span>Total</span><strong>${formatIDR(product.price)}</strong></div><div class="payment-note"><strong>⚠️ Catatan pembayaran</strong><p>Checkout lewat website bisa butuh waktu beberapa detik karena invoice/QRIS dibuat dulu.</p><p>Mau lebih cepat? Order lewat Bot Telegram langsung saja.</p><a href="${TELEGRAM_ADMIN}" target="_blank" rel="noopener">Order via Bot Telegram</a></div>`;
    form?.addEventListener("submit", async (e) => { e.preventDefault(); msg.textContent=""; submit.disabled=true; submit.textContent="Menyimpan..."; try { const fd=new FormData(form); const invoice=await createOrder({ buyerName: fd.get("buyerName"), buyerContact: fd.get("buyerContact"), paymentMethod: fd.get("paymentMethod"), product }); if(isCart) saveCart([]); msg.textContent="Pesanan berhasil dibuat. Mengarahkan ke invoice..."; msg.className="message success"; showToast("Order masuk! Bot Telegram akan menerima notifikasi."); location.href=invoiceUrl(invoice); } catch(err){ msg.textContent=err.message||"Gagal membuat pesanan."; msg.className="message error"; submit.disabled=false; submit.textContent="Buat Pesanan"; } });
  } catch(e){ summary.innerHTML = `<div class="error-state"><h3>Gagal memuat checkout</h3><p>${escapeHtml(e.message)}</p></div>`; }
}
function initCartPage() {
  const wrap = qs("#cartContent"); if (!wrap) return; const cart = getCart();
  if (!cart.length) { wrap.innerHTML = `<div class="empty-cart glass-card"><div>🛒</div><h2>Keranjang masih kosong</h2><p>Silakan pilih produk dulu.</p><a class="btn btn-primary" href="./produk.html">Lihat Produk</a></div>`; return; }
  wrap.innerHTML = `<div class="cart-list">${cart.map(i => `<article class="cart-item glass-card">${imageMarkup(i, "cart-img")}<div><h3>${escapeHtml(i.name)}</h3><p>${escapeHtml(i.categoryName)} • Qty ${i.qty}</p><strong>${formatIDR(i.price * i.qty)}</strong></div><button class="btn btn-ghost" data-remove-cart="${escapeHtml(i.id)}">Hapus</button></article>`).join("")}</div><div class="glass-card cart-total"><span>Total</span><strong>${formatIDR(cartTotal(cart))}</strong><a class="btn btn-primary full" href="./checkout.html">Checkout Keranjang</a></div>`;
}
function buildWhatsAppConfirmUrl(o) { const m=[`Halo admin ${STORE_NAME}, saya ingin konfirmasi pesanan.`,`Invoice: ${o.invoice}`,`Nama: ${o.buyerName}`,`Kontak: ${o.buyerContact}`,`Produk: ${o.productName}`,`Total: ${formatIDR(o.price)}`,`Metode: ${o.paymentMethod}`,`Status: ${o.status || "Pending"}`].join("\n"); return `https://wa.me/${ADMIN_WHATSAPP}?text=${encodeURIComponent(m)}`; }
async function initInvoicePage() {
  const c=qs("#invoiceContent"), inv=getParam("invoice"), stored=getLastInvoiceFromStorage(); if(!inv&&!stored){ c.innerHTML=`<div class="error-state"><h3>Invoice tidak ditemukan</h3><p>Nomor invoice tidak ada di URL.</p></div>`; return; }
  let order=stored?.invoice===inv?stored:null; if(isFirebaseConfigured&&inv){ try{ order=await fetchOrderByInvoice(inv)||order; }catch(e){ console.error(e); } }
  if(!order){ c.innerHTML=`<div class="error-state"><h3>Invoice tidak ditemukan</h3><p>Pastikan nomor invoice benar.</p></div>`; return; }
  const wa=buildWhatsAppConfirmUrl(order);
  c.innerHTML = `<div class="invoice-head"><div class="invoice-title"><p class="eyebrow">Invoice Premium</p><h1>Pesanan dibuat</h1><p class="invoice-number">${escapeHtml(order.invoice)}</p></div><span class="status-badge ${statusClass(order.status)}">${escapeHtml(order.status||"Pending")}</span></div><div class="invoice-table"><div class="invoice-row"><span>Nama</span><strong>${escapeHtml(order.buyerName)}</strong></div><div class="invoice-row"><span>Kontak</span><strong>${escapeHtml(order.buyerContact)}</strong></div><div class="invoice-row"><span>Produk</span><strong>${escapeHtml(order.productName)}</strong></div><div class="invoice-row"><span>Metode</span><strong>${escapeHtml(order.paymentMethod)}</strong></div><div class="invoice-row"><span>Tanggal</span><strong>${escapeHtml(formatDate(order.createdAt))}</strong></div></div><div class="invoice-total"><span>Total pembayaran</span><strong>${formatIDR(order.price)}</strong></div><div class="qris-box"><h3>Scan QRIS untuk pembayaran</h3><img src="../assets/qris.png" alt="QRIS Pinnly Store"><p>Website: tunggu beberapa detik kalau invoice/QRIS diproses. Bot Telegram: proses langsung lebih cepat.</p></div><div class="order-alert glass-card"><strong>🔔 Notifikasi Telegram aktif</strong><p>Setelah order masuk, bot Telegram admin akan menerima notifikasi. Kirim bukti pembayaran lewat tombol di bawah.</p></div><div class="invoice-actions"><button class="btn btn-secondary" data-copy="${escapeHtml(order.invoice)}">Copy Invoice</button><a class="btn btn-primary pulse-soft" href="${wa}" target="_blank" rel="noopener">Kirim Bukti via WhatsApp</a><a class="btn btn-secondary" href="${TELEGRAM_ADMIN}" target="_blank" rel="noopener">Bukti via Telegram</a></div>`;
}

setupCommonUI();
loadDynamicWebContent();
if (page === "home") initHomePage();
if (page === "products") initProductsPage();
if (page === "detail") initDetailPage();
if (page === "checkout") initCheckoutPage();
if (page === "cart") initCartPage();
if (page === "invoice") initInvoicePage();
