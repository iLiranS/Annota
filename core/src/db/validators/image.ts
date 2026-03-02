import { z } from 'zod';

export const imageUrlSchema = z.string()
    .url("Invalid URL format")
    .refine((url) => {
        const imageExtensions = /\.(webp|png|jpe?g|gif|svg|bmp|tiff)$/i;
        return imageExtensions.test(url);
    }, {
        message: "URL must point to a valid image (webp, png, jpeg, gif, svg, etc.)"
    });

export const imageInputSchema = z.object({
    url: imageUrlSchema,
});

export type ImageInputData = z.infer<typeof imageInputSchema>;
