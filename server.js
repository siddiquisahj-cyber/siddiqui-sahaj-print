const express = require('express');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// अपलोड डायरेक्टरी
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '_'))
});
const upload = multer({ storage });

// रेट लिस्ट
const RATES = {
    bw_single: 5,
    color: 10
};

let orders = [];
let tokenCounter = 101;

// बैकअप PDF पेज काउंटर (अगर pdf-parse फेल हो जाए)
function getPdfPageCountFallback(buffer) {
    try {
        const text = buffer.toString('latin1');
        const matches = text.match(/\/Type\s*\/Page\b/g);
        if (matches && matches.length > 0) {
            return matches.length;
        }
        // कुछ PDFs में /Count N लिखा होता है
        const countMatch = text.match(/\/Count\s+(\d+)/);
        if (countMatch && countMatch[1]) {
            return parseInt(countMatch[1], 10);
        }
    } catch (e) {
        console.error("Fallback error:", e);
    }
    return 1;
}

// 1. फाइल अपलोड और बिल कैलकुलेशन
app.post('/api/upload-and-calculate', upload.single('document'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'कोई फाइल नहीं मिली' });
        }
        
        const printType = req.body.printType || 'bw_single';
        const copies = parseInt(req.body.copies) || 1;
        let totalPages = 1;

        if (req.file.originalname.toLowerCase().endsWith('.pdf')) {
            try {
                const dataBuffer = fs.readFileSync(req.file.path);
                const pdfData = await pdfParse(dataBuffer);
                if (pdfData && pdfData.numpages) {
                    totalPages = pdfData.numpages;
                } else {
                    totalPages = getPdfPageCountFallback(dataBuffer);
                }
            } catch (pdfErr) {
                console.log("pdf-parse failed, using fallback:", pdfErr.message);
                const dataBuffer = fs.readFileSync(req.file.path);
                totalPages = getPdfPageCountFallback(dataBuffer);
            }
        }

        const rate = RATES[printType] || 5;
        const totalAmount = totalPages * rate * copies;

        console.log(फाइल: ${req.file.originalname} | कुल पेज: ${totalPages} | कुल बिल: ₹${totalAmount});

        res.json({
            success: true,
            fileId: req.file.filename,
            originalName: req.file.originalname,
            totalPages: totalPages,
            totalAmount: totalAmount,
            printType: printType,
            copies: copies
        });
    } catch (err) {
        console.error("Upload error:", err);
        res.status(500).json({ success: false, error: 'सर्वर पर फाइल प्रोसेस नहीं हो सकी' });
    }
});

// 2. ऑर्डर कन्फर्मेशन
app.post('/api/confirm-order', (req, res) => {
    const newOrder = {
        tokenNo: tokenCounter++,
        customerName: req.body.customerName || 'ग्राहक',
        customerPhone: req.body.customerPhone || '-',
        originalName: req.body.originalName || 'document.pdf',
        fileId: req.body.fileId,
        totalPages: req.body.totalPages || 1,
        totalAmount: req.body.totalAmount || 5,
        printType: req.body.printType || 'bw_single',
        copies: req.body.copies || 1,
        createdAt: new Date().toLocaleTimeString('hi-IN', { hour: '2-digit', minute: '2-digit' })
    };
    orders.unshift(newOrder);
    res.json({ success: true, order: newOrder });
});

// 3. एडमिन के लिए ऑर्डर्स लिस्ट
app.get('/api/admin/orders', (req, res) => {
    res.json(orders);
});

// 4. फाइल डाउनलोड रूट (प्रिंट निकालने के लिए)
app.get('/api/download/:filename', (req, res) => {
    const filePath = path.join(uploadDir, req.params.filename);
    if (fs.existsSync(filePath)) {
        res.download(filePath);
    } else {
        res.status(404).send('फाइल नहीं मिली');
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(सर्वर पोर्ट ${PORT} पर चालू है));
