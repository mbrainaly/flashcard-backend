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
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const connectDB = () => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        console.log('Attempting to connect to MongoDB...');
        console.log('MongoDB URI:', (_a = process.env.MONGODB_URI) === null || _a === void 0 ? void 0 : _a.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@')); // Log URI with hidden password
        if (!process.env.MONGODB_URI) {
            throw new Error('MONGODB_URI is not defined in environment variables');
        }
        const conn = yield mongoose_1.default.connect(process.env.MONGODB_URI);
        // Log connection status
        console.log(`MongoDB Connected: ${conn.connection.host}`);
        console.log('Database name:', conn.connection.name);
        console.log('Connection state:', conn.connection.readyState);
        // Ensure indexes are created
        yield mongoose_1.default.connection.db.collection('users').createIndex({ email: 1 }, { unique: true });
        console.log('User indexes verified');
    }
    catch (error) {
        console.error('Error connecting to MongoDB:');
        if (error instanceof Error) {
            console.error('Error message:', error.message);
            console.error('Error stack:', error.stack);
        }
        process.exit(1);
    }
});
exports.default = connectDB;
