export interface FolderInsertInput {
    name: string;
    [key: string]: any;
}

export const insertFolderSchema = {
    parse: (data: FolderInsertInput) => {
        if (!data.name || data.name.trim().length === 0) {
            throw new Error("Folder name is required");
        }
        if (data.name.length > 50) {
            throw new Error("Folder name must be 50 characters or less");
        }
        return data;
    },
    partial: () => ({
        parse: (data: Partial<FolderInsertInput>) => {
            if (data.name !== undefined) {
                if (data.name.trim().length === 0) {
                    throw new Error("Folder name must be at least 1 character");
                }
                if (data.name.length > 50) {
                    throw new Error("Folder name must be 50 characters or less");
                }
            }
            return data;
        }
    })
};

