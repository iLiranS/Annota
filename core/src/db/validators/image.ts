export interface ImageInputData {
    url: string;
}

const imageExtensions = /\.(webp|png|jpe?g|gif|svg|bmp|tiff)$/i;

export const imageUrlSchema = {
    parse: (url: string) => {
        if (!url) {
            throw new Error("URL is required");
        }
        try {
            new URL(url);
        } catch (_) {
            throw new Error("Invalid URL format");
        }
        if (!imageExtensions.test(url)) {
            throw new Error("URL must point to a valid image (webp, png, jpeg, gif, svg, etc.)");
        }
        return url;
    }
};

export const imageInputSchema = {
    parse: (data: ImageInputData) => {
        imageUrlSchema.parse(data.url);
        return data;
    }
};

