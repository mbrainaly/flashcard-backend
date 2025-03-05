"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
exports.extractTextFromFile = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const pdf_js_extract_1 = require("pdf.js-extract");
const mammoth_1 = __importDefault(require("mammoth"));
const util_1 = require("util");
const readFile = (0, util_1.promisify)(fs.readFile);
const pdfExtract = new pdf_js_extract_1.PDFExtract();
const extractTextFromFile = (file) => __awaiter(void 0, void 0, void 0, function* () {
    const extension = path.extname(file.originalname).toLowerCase();
    try {
        switch (extension) {
            case '.pdf':
                // Use a more type-safe approach with a temporary file
                const tempFilePath = path.join(__dirname, '../../uploads', `temp_${Date.now()}.pdf`);
                fs.writeFileSync(tempFilePath, file.buffer);
                try {
                    const pdfData = yield pdfExtract.extract(tempFilePath);
                    const text = pdfData.pages
                        .map(page => page.content.map((item) => item.str).join(' '))
                        .join('\n');
                    // Clean up temp file
                    fs.unlinkSync(tempFilePath);
                    return text;
                }
                catch (err) {
                    // Clean up temp file in case of error
                    if (fs.existsSync(tempFilePath)) {
                        fs.unlinkSync(tempFilePath);
                    }
                    throw err;
                }
            case '.docx':
                const docxResult = yield mammoth_1.default.extractRawText({ buffer: file.buffer });
                return docxResult.value;
            case '.doc':
                // For .doc files, we'll return a message suggesting conversion to .docx
                return 'Note: For better results, please convert .doc files to .docx format.';
            case '.txt':
                return file.buffer.toString('utf-8');
            case '.jpg':
            case '.jpeg':
            case '.png':
                // For images, we'll return a message about manual input
                return 'Note: For images, please type out the relevant information in the question field.';
            default:
                throw new Error('Unsupported file type');
        }
    }
    catch (error) {
        console.error('Error extracting text from file:', error);
        throw new Error('Failed to process file');
    }
});
exports.extractTextFromFile = extractTextFromFile;
//# sourceMappingURL=fileProcessing.js.map