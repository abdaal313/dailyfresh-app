// ========================================
// DailyFresh Shop - Secure Cart Script
// ========================================

// --- 1. STATE ---
let cart = [];
let cartTotal = 0;
let currentPaymentMethod = 'UPI'; // 'UPI' or 'STRIPE' (matches server validation)

// --- 2. SAFE STORAGE ---
function getCart() {
    try {
        return JSON.parse(localStorage.getItem('cart')) || [];
    } catch (e) {
        console.warn('localStorage blocked, using memory storage');
        return cart;
    }
}

function setCart(data) {
    cart = data;
    try {
        localStorage.setItem('cart', JSON.stringify(data));
    } catch (e) {
        console.warn('Cannot save to localStorage, using memory storage only');
    }
}

function clearCart() {
    cart = [];
    try {
        localStorage.removeItem('cart');
    } catch (e) {
        console.warn('Cannot clear localStorage');
    }
}

cart = getCart();

// --- 3. VALIDATION ---
const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || '');

const validatePhone = (phone) => (phone || '').replace(/\D/g, '').length === 10;

const validateString = (str, minLen = 2, maxLen = 255) =>
    typeof str === 'string' && str.trim().length >= minLen && str.trim().length <= maxLen;

const escapeHtml = (text) => {
    const div = document.createElement('div');
    div.textContent = text == null ? '' : String(text);
    return div.innerHTML;
};

// --- 4. CART LOGIC ---
window.addToCart = function (itemName, itemPrice, qty = 1, itemImage = null) {
    if (!validateString(itemName, 1, 100)) {
        alert('❌ Invalid item name');
        return;
    }

    const price = parseFloat(itemPrice);
    if (isNaN(price) || price <= 0 || price > 100000) {
        alert('❌ Invalid price');
        return;
    }

    const quantity = Math.max(1, Math.min(999, parseInt(qty) || 1));

    const existingItem = cart.find(i => i.name === itemName);
    if (existingItem) {
        existingItem.quantity = Math.min(999, (existingItem.quantity || 1) + quantity);
    } else {
        cart.push({ name: itemName, price, quantity, image: itemImage || null });
    }

    setCart(cart);
    renderCart();
    alert(`✅ Added ${itemName} to your cart!`);
};

window.updateQuantity = function (index, change) {
    if (!cart[index]) return;
    cart[index].quantity = (parseInt(cart[index].quantity) || 1) + change;

    if (cart[index].quantity < 1) {
        cart.splice(index, 1);
    } else if (cart[index].quantity > 999) {
        cart[index].quantity = 999;
    }

    setCart(cart);
    renderCart();
};

window.increaseQty = function (index) {
    window.updateQuantity(index, 1);
};

window.decreaseQty = function (index) {
    window.updateQuantity(index, -1);
};

window.removeFromCart = function (index) {
    if (index < 0 || index >= cart.length) return;
    cart.splice(index, 1);
    setCart(cart);
    renderCart();
};

// --- 5. UI RENDERING (single source of truth) ---
window.renderCart = function () {
    cart = getCart();

    const cartCountEl = document.getElementById('cart-count');
    const cartListEl = document.getElementById('cart-items');
    const checkoutItemsEl = document.getElementById('checkout-cart-items');
    const cartTotalEl = document.getElementById('cart-total');
    const checkoutTotalEl = document.getElementById('checkout-total');
    const upiAmountEl = document.getElementById('upi-amount');
    const cartErrorEl = document.getElementById('cart-error');

    const totalQty = cart.reduce((sum, item) => sum + (parseInt(item.quantity) || 1), 0);
    if (cartCountEl) cartCountEl.innerText = totalQty;

    cartTotal = cart.reduce((sum, item) => sum + (parseFloat(item.price) * (item.quantity || 1)), 0);
    if (cartTotalEl) cartTotalEl.innerText = cartTotal.toFixed(2);
    if (checkoutTotalEl) checkoutTotalEl.innerText = cartTotal.toFixed(2);
    if (upiAmountEl) upiAmountEl.innerText = cartTotal.toFixed(2);

    // Shop page cart list
    if (cartListEl) {
        if (cart.length === 0) {
            cartListEl.innerHTML = '<li class="empty-msg" style="padding: 20px; text-align: center; color: #999;">Your tray is empty. Add some items!</li>';
        } else {
            cartListEl.innerHTML = '';
            cart.forEach((item, index) => {
                const li = document.createElement('li');
                li.className = 'cart-item';
                li.innerHTML = `
                    <div style="flex: 1;">
                        <strong>${escapeHtml(item.name)}</strong><br>
                        <span style="color: #718096;">₹${parseFloat(item.price).toFixed(2)} × ${item.quantity} = ₹${(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                    <div style="display: flex; gap: 8px; align-items: center;">
                        <button onclick="window.decreaseQty(${index})" style="padding: 5px 10px; background: #e74c3c; color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: bold;">−</button>
                        <span style="min-width: 25px; text-align: center; font-weight: bold;">${item.quantity}</span>
                        <button onclick="window.increaseQty(${index})" style="padding: 5px 10px; background: #27ae60; color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: bold;">+</button>
                        <button onclick="window.removeFromCart(${index})" style="padding: 5px 10px; background: #95a5a6; color: white; border: none; border-radius: 5px; cursor: pointer;">🗑</button>
                    </div>
                `;
                cartListEl.appendChild(li);
            });
        }
    }

    // Checkout page item summary
    if (checkoutItemsEl) {
        if (cartErrorEl) cartErrorEl.classList.remove('show');

        if (cart.length === 0) {
            checkoutItemsEl.innerHTML = '<p style="color: #999;">Your cart is empty</p>';
            if (cartErrorEl) {
                cartErrorEl.textContent = 'Please add items to your cart before checkout';
                cartErrorEl.classList.add('show');
            }
        } else {
            checkoutItemsEl.innerHTML = '';
            cart.forEach((item) => {
                const itemDiv = document.createElement('div');
                itemDiv.className = 'product-item';

                const imageSource = item.image && item.image !== 'default.jpg'
                    ? `/uploads/${item.image}`
                    : 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2280%22 height=%2280%22%3E%3Crect fill=%22%23f5f5f5%22 width=%2280%22 height=%2280%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%23999%22 font-size=%2212%22%3ENo Image%3C/text%3E%3C/svg%3E';

                itemDiv.innerHTML = `
                    <img src="${imageSource}" alt="${escapeHtml(item.name)}" class="product-image" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2280%22 height=%2280%22%3E%3Crect fill=%22%23f5f5f5%22 width=%2280%22 height=%2280%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%23999%22 font-size=%2212%22%3ENo Image%3C/text%3E%3C/svg%3E'">
                    <div class="product-details">
                        <h4>${escapeHtml(item.name)}</h4>
                        <p>Quantity: ${item.quantity}</p>
                        <p class="product-price">₹${parseFloat(item.price).toFixed(2)} each</p>
                    </div>
                    <div style="text-align: right;">
                        <p style="font-weight: bold; color: var(--accent);">₹${(parseFloat(item.price) * item.quantity).toFixed(2)}</p>
                    </div>
                `;
                checkoutItemsEl.appendChild(itemDiv);
            });
        }
    }
};

// Kept as an alias so older inline handlers / calls keep working
window.updateCartUI = window.renderCart;

// --- 6. PAYMENT METHOD SWITCHING ---
window.switchPayment = function (method, evt) {
    const tabs = document.querySelectorAll('.payment-tab');
    const contents = document.querySelectorAll('.payment-content');

    tabs.forEach(tab => tab.classList.remove('active'));
    contents.forEach(content => content.classList.remove('active'));

    const clickedTab = (evt && evt.target ? evt.target : window.event?.target)?.closest('.payment-tab');
    if (clickedTab) clickedTab.classList.add('active');

    if (method === 'stripe' || method === 'debit-card') {
        currentPaymentMethod = 'STRIPE';
        document.getElementById('payment-debit-card')?.classList.add('active');
        document.getElementById('payment-stripe')?.classList.add('active');
        if (!clickedTab) tabs[1]?.classList.add('active');
    } else {
        currentPaymentMethod = 'UPI';
        document.getElementById('payment-upi')?.classList.add('active');
        if (!clickedTab) tabs[0]?.classList.add('active');
    }
};

// --- 7. CHECKOUT ---
window.completeOrder = async function () {
    cart = getCart();
    const errorEl = document.getElementById('payment-error');
    const successEl = document.getElementById('payment-success');
    errorEl?.classList.remove('show');
    successEl?.classList.remove('show');

    if (cart.length === 0) {
        if (errorEl) { errorEl.textContent = 'Your cart is empty! Add some items first.'; errorEl.classList.add('show'); }
        return;
    }

    const name = document.getElementById('cust-name')?.value?.trim();
    const email = document.getElementById('cust-email')?.value?.trim();
    const phone = document.getElementById('cust-phone')?.value?.trim();
    const address = document.getElementById('cust-address')?.value?.trim();
    const lat = document.getElementById('lat')?.value;
    const lng = document.getElementById('lng')?.value;

    if (!validateString(name, 2, 100)) return showError(errorEl, 'Please enter a valid name (2-100 characters)');
    if (!validateEmail(email)) return showError(errorEl, 'Please enter a valid email address');
    if (!validatePhone(phone)) return showError(errorEl, 'Please enter a valid 10-digit phone number');
    if (!validateString(address, 5, 500)) return showError(errorEl, 'Please enter a valid address (5-500 characters)');
    if (!lat || !lng) return showError(errorEl, 'Please set your delivery location on the map');

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    if (isNaN(latitude) || isNaN(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
        return showError(errorEl, 'Invalid location coordinates');
    }

    // If debit card tab is active, validate card fields (card payments are simulated as STRIPE)
    const activeTab = document.querySelector('.payment-tab.active');
    if (activeTab && activeTab.innerText.includes('Card')) {
        const cardHolder = document.getElementById('card-holder')?.value?.trim();
        const cardNumber = document.getElementById('card-number')?.value?.replace(/\s/g, '');
        const expiry = document.getElementById('expiry')?.value;
        const cvv = document.getElementById('cvv')?.value;

        if (!cardHolder || !cardNumber || cardNumber.length !== 16 || !expiry || !cvv || cvv.length < 3) {
            return showError(errorEl, 'Please enter valid card details');
        }
        currentPaymentMethod = 'STRIPE';
    } else {
        currentPaymentMethod = 'UPI';
    }

    const orderData = {
        customer: { name, email, phone, address },
        items: cart,
        total: parseFloat(cartTotal.toFixed(2)),
        paymentMethod: currentPaymentMethod,
        lat: latitude,
        lng: longitude
    };

    try {
        const response = await fetch('/api/checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orderData)
        });

        const data = await response.json();

        if (response.ok && data.orderId) {
            if (successEl) {
                successEl.textContent = `Order #${data.orderId} placed successfully! Redirecting...`;
                successEl.classList.add('show');
            }
            clearCart();
            setTimeout(() => { window.location.href = 'index.html'; }, 2000);
        } else {
            showError(errorEl, data.message || 'Order failed. Please try again.');
        }
    } catch (err) {
        console.error('Checkout error:', err);
        showError(errorEl, 'Network error. Please check your connection and that the server is running.');
    }
};

function showError(el, message) {
    if (el) {
        el.textContent = message;
        el.classList.add('show');
    } else {
        alert(`❌ ${message}`);
    }
}

// --- 8. NEWSLETTER SUBSCRIPTION ---
window.subscribeNewsletter = async function () {
    const emailInput = document.getElementById('sub-email');
    const email = emailInput?.value?.trim();

    if (!validateEmail(email)) {
        alert('❌ Please enter a valid email address!');
        return;
    }

    try {
        const response = await fetch('/api/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });

        const data = await response.json();

        if (response.ok) {
            alert(data.message || 'Subscribed successfully!');
            if (emailInput) emailInput.value = '';
        } else {
            alert(`⚠️ ${data.message || 'Subscription failed'}`);
        }
    } catch (err) {
        console.error('Subscribe error:', err);
        alert('loading....');
    }
};

// --- 9. ORDER TRACKING ---
window.trackOrder = async function () {
    const orderId = document.getElementById('track-order-id')?.value?.trim();

    if (!orderId || isNaN(parseInt(orderId))) {
        alert('❌ Please enter a valid order ID!');
        return;
    }

    try {
        const response = await fetch(`/api/order/${orderId}`);
        const order = await response.json();

        if (response.ok) {
            const statusEmoji = {
                Pending: '⏳', Confirmed: '✅', Shipped: '🚚', Delivered: '🎉', Cancelled: '❌'
            };
            const emoji = statusEmoji[order.status] || '📦';
            alert(`${emoji} Order #${order.id}\n\nStatus: ${order.status}\nTotal: ₹${order.total}\nDelivery: ${order.address}`);
        } else {
            alert('❌ Order not found!');
        }
    } catch (err) {
        console.error('Track order error:', err);
        alert('❌ Could not fetch order details.');
    }
};

// --- 10. INIT ---
document.addEventListener('DOMContentLoaded', () => {
    renderCart();

    const newsletterForm = document.getElementById('newsletter-form');
    newsletterForm?.addEventListener('submit', (e) => {
        e.preventDefault();
        window.subscribeNewsletter();
    });

    const checkoutForm = document.getElementById('checkout-form');
    checkoutForm?.addEventListener('submit', (e) => {
        e.preventDefault();
        window.completeOrder();
    });

    const paymentTabs = document.querySelectorAll('.payment-tab');
    if (paymentTabs.length > 0) {
        paymentTabs[0].classList.add('active');
        document.querySelector('.payment-content')?.classList.add('active');
    }

    document.getElementById('track-btn')?.addEventListener('click', window.trackOrder);
});

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { validateEmail, validatePhone, validateString, escapeHtml };
}