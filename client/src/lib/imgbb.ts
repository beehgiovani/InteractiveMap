
const API_KEY = '886ac1409ba4463ca5e2bc7aa1b313b7'; 

export const uploadImageToImgBB = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('image', file);
    // expiration: optional, default is forever

    const response = await fetch(`https://api.imgbb.com/1/upload?key=${API_KEY}`, {
        method: 'POST',
        body: formData,
    });

    const data = await response.json();

    if (!data.success) {
        throw new Error(data.error?.message || 'Falha no upload para o ImgBB');
    }

    return data.data.url;
};
