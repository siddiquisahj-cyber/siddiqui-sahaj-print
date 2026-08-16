const express = require('express');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// अपलोड फोल्डर
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}

const storage = multer.diskStorage({
    destination: 'uploads/',
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage });

// रेट लिस्ट
const RATES = {
    bw_single: 2,   // ₹2 प्रति B&W पेज
    color: 10       // ₹10 प्रति कलर पेज
};

let orders = [];
let tokenCounter = 101;

// बिलिंग और पेज कैलकुलेटर
app.post('/api/upload-and-calculate', upload.single('document'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'फाइल नहीं मिली' });

        const printType = req.body.printType || 'bw_single';
        const copies = parseInt(req.body.copies) || 1;
        let totalPages = 1;

        if (req.file.mimetype === 'application/pdf') {
            const dataBuffer = fs.readFileSync(req.file.path);
            const pdfData = await pdfParse(dataBuffer);
            totalPages = pdfData.numpages || 1;
        }

        let ratePerPage = RATES[printType] || 2;
        let totalAmount = totalPages * ratePerPage * copies;

        res.json({
            success: true,
            fileId: req.file.filename,
            originalName: req.file.originalname,
            totalPages,
            ratePerPage,
            copies,
            totalAmount
        });
    } catch (err) {
        res.status(500).json({ error: 'फाइल प्रोसेस करने में त्रुटि' });
    }
});

// पेमेंट के बाद ऑर्डर कन्फर्म करना
app.post('/api/confirm-order', (req, res) => {
    const { fileId, originalName, totalPages, printType, copies, totalAmount, customerName, customerPhone } = req.body;

    const newOrder = {
        tokenNo: tokenCounter++,
        fileId,
        originalName,
        totalPages,
        printType,
        copies,
        totalAmount,
        customerName: customerName || 'ग्राहक',
        customerPhone: customerPhone || 'N/A',
        createdAt: new Date().toLocaleTimeString('hi-IN', { hour: '2-digit', minute: '2-digit' })
    };

    orders.unshift(newOrder);
    res.json({ success: true, order: newOrder });
});

// डैशबोर्ड ऑर्डर्स
app.get('/api/admin/orders', (req, res) => {
    res.json(orders);
});

// फाइल डाउनलोड
app.get('/api/download/:fileId', (req, res) => {
    const filePath = path.join(__dirname, 'uploads', req.params.fileId);
    if (fs.existsSync(filePath)) {
        res.download(filePath);
    } else {
        res.status(404).send('फाइल नहीं मिली');
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log("SIDDIQUI SAHAJ Server Running at: http://localhost:3000");
});