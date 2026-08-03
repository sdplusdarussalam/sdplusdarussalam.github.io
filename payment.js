import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js";

// Konfigurasi Firebase
const firebaseConfig = {
    apiKey: "AIzaSyD...",
    authDomain: "tagihan-siswa-1f2df.firebaseapp.com",
    projectId: "tagihan-siswa-1f2df",
    storageBucket: "tagihan-siswa-1f2df.appspot.com",
    messagingSenderId: "1234567890",
    appId: "1:1234567890:web:abcdef"
};

// Inisialisasi Firebase & Cloud Functions
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const functions = getFunctions(app, 'asia-southeast2');

// Elemen DOM (UI)
const nisInput = document.getElementById('nis-input');
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
const studentProgressText = document.getElementById('student-progress-text');
const studentProgressBar = document.getElementById('student-progress-bar');
const totalBill = document.getElementById('total-bill');
const payAmount = document.getElementById('pay-amount');
const statusTagihanBadge = document.getElementById('status-tagihan-badge');

let currentStudent = null;

// Fungsi Tampil/Sembunyi Loading
const showLoading = (text = "Memproses...") => {
    loadingText.innerText = text;
    loadingOverlay.classList.remove('hidden');
};
const hideLoading = () => loadingOverlay.classList.add('hidden');

// Function Pencarian Siswa di Firestore
searchBtn.addEventListener('click', async () => {
    const nis = nisInput.value.trim();
    if (!nis) return alert('Silakan masukkan NIS!');

    showLoading("Mencari data siswa...");

    try {
        const docRef = doc(db, "siswa", nis);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            currentStudent = docSnap.data();
            renderStudentData(currentStudent, nis);
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
    
    const total = data.rekapTerakhir?.total || 0;
    const progres = data.progres || 0;

    studentProgressText.innerText = `${progres}%`;
    studentProgressBar.style.width = `${progres}%`;
    totalBill.innerText = `Rp ${total.toLocaleString('id-ID')}`;
    payAmount.value = total;

    if (total <= 0) {
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

// Function Transaksi Midtrans
async function processPayment(metode) {
    if (!currentStudent) return alert("Pilih siswa terlebih dahulu!");
    
    const nominal = parseInt(payAmount.value);
    if (!nominal || nominal <= 0) {
        return alert("Nominal pembayaran harus lebih dari 0!");
    }

    showLoading("Menghubungkan ke Gateway Pembayaran...");

    try {
        const createTransaction = httpsCallable(functions, 'createMidtransTransaction');
        const result = await createTransaction({
            nis: studentNis.innerText,
            nama: currentStudent.nama,
            kelas: currentStudent.kelas,
            nominal: nominal,
            metode: metode
        });

        const snapToken = result.data.token;
        hideLoading();

        // Popup Midtrans Snap SDK
        window.snap.pay(snapToken, {
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

    } catch (error) {
        hideLoading();
        console.error("Payment Error:", error);
        alert("Gagal menghubungkan ke Server Pembayaran. Pastikan Backend Cloud Function sudah di-deploy.");
    }
}

// Function Update Tagihan Firestore
async function updateSisaTagihan(nis, nominalBayar) {
    try {
        const siswaRef = doc(db, "siswa", nis);
        const currentTotal = currentStudent.rekapTerakhir?.total || 0;
        const newTotal = Math.max(0, currentTotal - nominalBayar);
        
        await updateDoc(siswaRef, {
            "rekapTerakhir.total": newTotal,
            "progres": newTotal === 0 ? 100 : currentStudent.progres
        });
    } catch (e) {
        console.error("Gagal update data Firestore:", e);
    }
}

// Event Listener Tombol Metode Bayar
document.getElementById('btn-pay-qris').addEventListener('click', () => processPayment('qris'));
document.getElementById('btn-pay-va').addEventListener('click', () => processPayment('va'));