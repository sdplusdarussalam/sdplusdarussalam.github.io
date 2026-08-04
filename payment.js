// ==========================================
// CONFIG & BACKEND URL
// ==========================================
const API_BACKEND_URL = 'https://documents-delta-gold.vercel.app/api';

// Element Selectors
const nisInput = document.getElementById('nis-input');
const motherInput = document.getElementById('mother-input');
const searchBtn = document.getElementById('search-btn');

const studentCard = document.getElementById('student-card');
const emptyState = document.getElementById('empty-state');
const paymentPanel = document.getElementById('payment-panel');

const studentName = document.getElementById('student-name');
const studentNis = document.getElementById('student-nis');
const studentClass = document.getElementById('student-class');
const studentMother = document.getElementById('student-mother');
const studentProgressText = document.getElementById('student-progress-text');
const studentProgressBar = document.getElementById('student-progress-bar');
const headerUserName = document.getElementById('header-user-name');
const userProfileBadge = document.getElementById('user-profile-badge');

const totalBill = document.getElementById('total-bill');
const payAmountInput = document.getElementById('pay-amount');
const btnPayQris = document.getElementById('btn-pay-qris');
const btnPayVa = document.getElementById('btn-pay-va');
const loadingOverlay = document.getElementById('loading-overlay');
const loadingText = document.getElementById('loading-text');

let currentStudentData = null;

// ==========================================
// UTILITY FUNCTIONS
// ==========================================
function formatRupiah(amount) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount);
}

function showLoading(text = 'Memproses...') {
    if (loadingText) loadingText.innerText = text;
    if (loadingOverlay) loadingOverlay.classList.remove('hidden');
}

function hideLoading() {
    if (loadingOverlay) loadingOverlay.classList.add('hidden');
}

// ==========================================
// LOGIKA PENCARIAN DATA SISWA
// ==========================================
searchBtn.addEventListener('click', async () => {
    const nis = nisInput.value.trim();
    const mother = motherInput.value.trim();

    if (!nis) {
        alert('Silakan masukkan Nomor Induk Siswa (NIS)!');
        return;
    }

    showLoading('Mencari data siswa...');

    try {
        // Simulasi pencarian data siswa (Bisa disesuaikan dengan API backend Anda jika ada)
        // Di sini dibuatkan data dummy/dinamis berdasarkan input
        currentStudentData = {
            nis: nis,
            name: 'Siswa ID ' + nis,
            class: 'Kelas 4A',
            motherName: mother || 'Ibu Kandung',
            totalBill: 500000,
            paidProgress: 50
        };

        // Render ke UI
        studentName.innerText = currentStudentData.name;
        studentNis.innerText = currentStudentData.nis;
        studentClass.innerText = currentStudentData.class;
        studentMother.innerText = currentStudentData.motherName;
        studentProgressText.innerText = `${currentStudentData.paidProgress}%`;
        studentProgressBar.style.width = `${currentStudentData.paidProgress}%`;
        
        if (headerUserName) headerUserName.innerText = currentStudentData.name;
        if (userProfileBadge) userProfileBadge.classList.remove('hidden');

        totalBill.innerText = formatRupiah(currentStudentData.totalBill);
        payAmountInput.value = currentStudentData.totalBill; // Default isi nominal penuh

        // Tampilkan Card & Panel
        emptyState.classList.add('hidden');
        studentCard.classList.remove('hidden');
        paymentPanel.classList.remove('hidden');

    } catch (err) {
        alert('Gagal mengambil data siswa: ' + err.message);
    } finally {
        hideLoading();
    }
});

// ==========================================
// INTEGRASI PEMBAYARAN MIDTRANS
// ==========================================
async function processPayment() {
    const payAmount = parseInt(payAmountInput.value);

    if (!payAmount || payAmount < 10000) {
        alert('Nominal pembayaran minimal Rp 10.000');
        return;
    }

    if (!currentStudentData) {
        alert('Silakan cari data siswa terlebih dahulu!');
        return;
    }

    showLoading('Menghubungkan ke Gateway Pembayaran...');

    try {
        // Generate Order ID Unik (Contoh: SPP-12345-1680000000)
        const orderId = `SPP-${currentStudentData.nis}-${Date.now()}`;

        // Kirim request ke Vercel Serverless Function
        const response = await fetch(API_BACKEND_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                order_id: orderId,
                gross_amount: payAmount,
                customer_details: {
                    first_name: currentStudentData.name,
                    email: 'siswa@sekolah.sch.id',
                    phone: '081234567890'
                }
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Terjadi kesalahan pada backend pembayaran');
        }

        hideLoading();

        // Panggil Pop-up Snap Midtrans menggunakan token yang didapat
        if (window.snap && data.token) {
            window.snap.pay(data.token, {
                onSuccess: function (result) {
                    alert('Pembayaran Berhasil!');
                    console.log('Success:', result);
                    location.reload();
                },
                onPending: function (result) {
                    alert('Menunggu Pembayaran Anda!');
                    console.log('Pending:', result);
                },
                onError: function (result) {
                    alert('Pembayaran Gagal atau Dibatalkan!');
                    console.error('Error:', result);
                },
                onClose: function () {
                    alert('Anda menutup halaman pembayaran sebelum selesai.');
                }
            });
        } else {
            alert('SDK Midtrans (snap.js) belum terload sempurna di browser.');
        }

    } catch (error) {
        hideLoading();
        alert('Gagal memproses transaksi: ' + error.message);
    }
}

// Event Listener Tombol Bayar
btnPayQris.addEventListener('click', processPayment);
btnPayVa.addEventListener('click', processPayment);
