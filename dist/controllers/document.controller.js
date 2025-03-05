"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeDocument = void 0;
const mammoth_1 = __importDefault(require("mammoth"));
const pdf_js_extract_1 = require("pdf.js-extract");
const util_1 = require("util");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const readFile = (0, util_1.promisify)(fs_1.default.readFile);
const pdfExtract = new pdf_js_extract_1.PDFExtract();
const analyzeDocument = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No file uploaded'
            });
        }
        const file = req.file;
        const fileExtension = path_1.default.extname(file.originalname).toLowerCase();
        let content = '';
        switch (fileExtension) {
            case '.pdf':
                try {
                    // Create a temporary file for the PDF
                    const tempPath = path_1.default.join(__dirname, `../../temp-${Date.now()}.pdf`);
                    fs_1.default.writeFileSync(tempPath, file.buffer);
                    const pdfData = yield pdfExtract.extract(tempPath);
                    content = pdfData.pages.map(page => page.content.map(item => item.str).join(' ')).join('\n');
                    // Clean up the temporary file
                    fs_1.default.unlinkSync(tempPath);
                }
                catch (pdfError) {
                    console.error('Error extracting PDF content:', pdfError);
                    return res.status(400).json({
                        success: false,
                        message: 'Failed to extract content from PDF. The file might be corrupted or password protected.'
                    });
                }
                break;
            case '.docx':
                try {
                    const docxResult = yield mammoth_1.default.extractRawText({ buffer: file.buffer });
                    content = docxResult.value;
                }
                catch (docxError) {
                    console.error('Error extracting DOCX content:', docxError);
                    return res.status(400).json({
                        success: false,
                        message: 'Failed to extract content from DOCX file. The file might be corrupted.'
                    });
                }
                break;
            case '.txt':
                content = file.buffer.toString('utf-8');
                break;
            default:
                return res.status(400).json({
                    success: false,
                    message: 'Unsupported file format. Please upload a PDF, DOCX, or TXT file.'
                });
        }
        return res.status(200).json({
            success: true,
            content: content.trim()
        });
    }
    catch (error) {
        console.error('Error analyzing document:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to analyze document'
        });
    }
});
exports.analyzeDocument = analyzeDocument;
//# sourceMappingURL=document.controller.js.map