import { supabase } from '../supabase';

/**
 * Supabase Storage Manager
 * 
 * Handles file uploads and management in Supabase Storage
 */

const BUCKET_NAME = 'lot-attachments';

/**
 * Upload an image for a lot
 * @param file - The image file to upload
 * @param lotId - The ID of the lot
 * @returns Public URL of the uploaded image
 */
export async function uploadLotImage(file: File, lotId: string): Promise<string> {
    // Generate unique filename
    const timestamp = Date.now();
    const fileExt = file.name.split('.').pop();
    const fileName = `${lotId}/${timestamp}.${fileExt}`;
    
    // Upload file
    const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(fileName, file, {
            cacheControl: '3600',
            upsert: false, // Don't overwrite existing files
        });
    
    if (error) {
        console.error('Error uploading image:', error);
        throw error;
    }
    
    // Get public URL
    const { data: publicData } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(data.path);
    
    return publicData.publicUrl;
}

/**
 * Delete an image
 * @param url - The public URL of the image to delete
 */
export async function deleteLotImage(url: string): Promise<void> {
    // Extract path from URL
    // URL format: https://PROJECT.supabase.co/storage/v1/object/public/BUCKET/PATH
    const urlParts = url.split(`/storage/v1/object/public/${BUCKET_NAME}/`);
    if (urlParts.length < 2) {
        throw new Error('Invalid image URL format');
    }
    
    const filePath = urlParts[1];
    
    const { error } = await supabase.storage
        .from(BUCKET_NAME)
        .remove([filePath]);
    
    if (error) {
        console.error('Error deleting image:', error);
        throw error;
    }
}

/**
 * List all images for a lot
 * @param lotId - The ID of the lot
 * @returns Array of public URLs
 */
export async function getLotImages(lotId: string): Promise<string[]> {
    const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .list(lotId);
    
    if (error) {
        console.error('Error listing images:', error);
        throw error;
    }
    
    if (!data) return [];
    
    // Get public URLs for all images
    const urls = data.map(file => {
        const { data: publicData } = supabase.storage
            .from(BUCKET_NAME)
            .getPublicUrl(`${lotId}/${file.name}`);
        return publicData.publicUrl;
    });
    
    return urls;
}

/**
 * Upload a document for a lot
 * @param file - The document file to upload
 * @param lotId - The ID of the lot
 * @returns Public URL of the uploaded document
 */
export async function uploadLotDocument(file: File, lotId: string): Promise<string> {
    const timestamp = Date.now();
    const fileExt = file.name.split('.').pop();
    const sanitizedName = file.name.replace(/[^a-z0-9.-]/gi, '_');
    const fileName = `${lotId}/docs/${timestamp}_${sanitizedName}`;
    
    const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(fileName, file, {
            cacheControl: '3600',
            upsert: false,
        });
    
    if (error) {
        console.error('Error uploading document:', error);
        throw error;
    }
    
    const { data: publicData } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(data.path);
    
    return publicData.publicUrl;
}

/**
 * Check if storage bucket exists and is accessible
 */
export async function checkStorageBucket(): Promise<boolean> {
    try {
        const { data, error } = await supabase.storage
            .from(BUCKET_NAME)
            .list('', { limit: 1 });
        
        if (error) {
            console.error('Storage bucket not accessible:', error);
            return false;
        }
        
        console.log('✅ Storage bucket is accessible');
        return true;
    } catch (error) {
        console.error('Error checking storage bucket:', error);
        return false;
    }
}
