import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Konfigurasi Firebase
const firebaseConfig = {
    apiKey: "AIzaSyD...",
    authDomain: "tagihan-siswa-1f2df.firebaseapp.com",
    projectId: "tagihan-siswa-1f2df",
    storageBucket: "tagihan-siswa-1f2df.appspot.com",
    messagingSenderId: "1234567890",
    appId: "1:1234567890:web:abcdef"
};

// Inisialisasi Firebase Firestore
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// URL Endpoint Vercel API
const VERCEL_API_URL = "https://documents-delta-gold.vercel.app/api";

// Elemen DOM (UI)
const nisInput = document.getElementById('nis-input');
const motherInput = document.getElementById('mother-input');
const searchBtn = document.getElementById('search-btn');
const emptyState = document.getElementById('empty-state');
const studentCard = document.getElementById('student-card');
const paymentPanel = document.getElementById('payment-panel');
const loadingOverlay = document.getElementById('loading-overlay');
const loadingText = document.getElementById('loading-text');

// Field Data Siswa
const studentName = document.getElementById('student-name');
const studentNis = document.getElementById('student-nis');
const studentClass = document.getElementById('student-class');
const studentMother = document.getElementById('student-mother');
const studentProgressText = document.getElementById('student-progress-text');
const studentProgressBar = document.getElementById('student-progress-bar');
const totalBill = document.getElementById('total-bill');
const payAmount = document.getElementById('pay-amount');
const statusTagihanBadge = document.getElementById('status-tagihan-badge');

let currentStudent = null;
let currentCalculatedTotal = 0;

// Fungsi Tampil/Sembunyi Loading
const showLoading = (text = "Memproses...") => {
    loadingText.innerText = text;
    loadingOverlay.classList.remove('hidden');
};
const hideLoading = () => loadingOverlay.classList.add('hidden');

// Function Pencarian Siswa di Firestore (NIS + Nama Ibu)
searchBtn.addEventListener('click', async () => {
    const nis = nisInput.value.trim();
    const motherName = motherInput ? motherInput.value.trim() : '';

    if (!nis || !motherName) {
        return alert('Silakan masukkan NIS dan Nama Ibu Kandung!');
    }

    showLoading("Mencari data siswa...");

    try {
        const docRef = doc(db, "siswa", nis);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();

            // Validasi Nama Ibu Kandung (Abaikan huruf besar/kecil)
            if (data.namaIbu && data.namaIbu.trim().toLowerCase() === motherName.toLowerCase()) {
                currentStudent = data;
                renderStudentData(currentStudent, nis);
            } else {
                alert('Data NIS ditemukan, tetapi Nama Ibu Kandung tidak cocok!');
            }
        } else {
            alert('Data siswa dengan NIS tersebut tidak ditemukan.');
        }
    } catch (error) {
        console.error("Error Firestore:", error);
        alert("Gagal mengambil data dari database.");
    } finally {
        hideLoading();
    }
});

// Function Render Data ke UI
function renderStudentData(data, nis) {
    studentName.innerText = data.nama || '-';
    studentNis.innerText = nis;
    studentClass.innerText = data.kelas || '-';
    if (studentMother) studentMother.innerText = data.namaIbu || '-';
    
    // Hitung total dari rekapLama (mengabaikan nilai null)
    currentCalculatedTotal = 0;
    if (data.rekapLama) {
        Object.values(data.rekapLama).forEach(val => {
            if (val && typeof val === 'number') {
                currentCalculatedTotal += val;
            }
        });
    }

    const progresStr = data.progres || "0%";

    studentProgressText.innerText = progresStr;
    studentProgressBar.style.width = progresStr;
    totalBill.innerText = `Rp ${currentCalculatedTotal.toLocaleString('id-ID')}`;
    payAmount.value = currentCalculatedTotal;

    if (currentCalculatedTotal <= 0) {
        statusTagihanBadge.innerText = "Lunas";
        statusTagihanBadge.className = "px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-full border border-emerald-200";
    } else {
        statusTagihanBadge.innerText = "Belum Lunas";
        statusTagihanBadge.className = "px-3 py-1 bg-amber-50 text-amber-700 text-xs font-semibold rounded-full border border-amber-200";
    }

    emptyState.classList.add('hidden');
    studentCard.classList.remove('hidden');
    paymentPanel.classList.remove('hidden');
}

// Function Transaksi Midtrans via Vercel
async function processPayment(metode) {
    if (!currentStudent) return alert("Pilih siswa terlebih dahulu!");
    
    const nominal = parseInt(payAmount.value);
    if (!nominal || nominal <= 0) {
        return alert("Nominal pembayaran harus lebih dari 0!");
    }

    showLoading("Menghubungkan ke Gateway Pembayaran...");

    try {
        // Request ke Server Vercel dengan mode CORS yang eksplisit
        const response = await fetch(VERCEL_API_URL, {
            method: 'POST',
            mode: 'cors',
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                order_id: "SPP-" + studentNis.innerText + "-" + Date.now(),
                gross_amount: nominal,
                customer_details: {
                    first_name: currentStudent.nama,
                    notes: "NIS: " + studentNis.innerText
                }
            })
        });

        const resData = await response.json();
        hideLoading();

        if (response.ok && resData.token) {
            // Cek ketersediaan SDK Snap
            if (typeof window.snap === 'undefined') {
                return alert("Snap SDK belum dimuat. Periksa koneksi atau atur CSP HTML Anda.");
            }

            // Popup Midtrans Snap SDK
            window.snap.pay(resData.token, {
                onSuccess: async function(result) {
                    alert("Pembayaran Berhasil!");
                    await updateSisaTagihan(studentNis.innerText, nominal);
                    location.reload();
                },
                onPending: function(result) {
                    alert("Menunggu Pembayaran. Silakan selesaikan instruksi pembayaran.");
                },
                onError: function(result) {
                    alert("Pembayaran gagal diproses!");
                },
                onClose: function() {
                    console.log('Pop-up pembayaran ditutup');
                }
            });
        } else {
            alert(`Gagal mendapatkan token: ${resData.error || resData.message || 'Error pada server Vercel'}`);
        }

    } catch (error) {
        hideLoading();
        console.error("Payment Error:", error);
        alert("Gagal koneksi ke Gateway Pembayaran Vercel. Pastikan server aktif dan CORS dikonfigurasi.");
    }
}

// Function Update Tagihan Firestore
async function updateSisaTagihan(nis, nominalBayar) {
    try {
        const siswaRef = doc(db, "siswa", nis);
        const newTotal = Math.max(0, currentCalculatedTotal - nominalBayar);
        
        await updateDoc(siswaRef, {
            "progres": newTotal === 0 ? "100%" : currentStudent.progres
        });
    } catch (e) {
        console.error("Gagal update data Firestore:", e);
    }
}

// Event Listener Tombol Metode Bayar
document.getElementById('btn-pay-qris').addEventListener('click', () => processPayment('qris'));
document.getElementById('btn-pay-va').addEventListener('click', () => processPayment('va'));
