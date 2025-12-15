// TODO: REPLACE WITH YOUR CLOUDINARY CLOUD NAME
const CLOUD_NAME = 'daeukchmj'; 
// TODO: REPLACE WITH YOUR UNSIGNED UPLOAD PRESET
const UPLOAD_PRESET = 'Interactive map'; 

export const uploadToCloudinary = async (file: File): Promise<string> => {
    // Basic validation
    if (!CLOUD_NAME || !UPLOAD_PRESET) {
        throw new Error('Cloudinary: Faltando configuração em client/src/lib/cloudinary.ts');
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', UPLOAD_PRESET);

    const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`, {
        method: 'POST',
        body: formData,
    });

    const data = await response.json();

    if (data.error) {
        throw new Error(data.error.message || 'Falha no upload para o Cloudinary');
    }

    return data.secure_url;
};
