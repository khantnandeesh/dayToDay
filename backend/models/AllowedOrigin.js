import mongoose from 'mongoose';

const allowedOriginSchema = new mongoose.Schema({
    url: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    addedAt: {
        type: Date,
        default: Date.now
    },
    description: String
});

export default mongoose.model('AllowedOrigin', allowedOriginSchema);
