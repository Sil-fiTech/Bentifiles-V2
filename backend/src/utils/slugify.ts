export function generateSlug(text: string): string {
    return text
        .toString()
        .toLowerCase()
        .trim()
        .normalize('NFD') // Remove acentos
        .replace(/[\u0300-\u036f]/g, '') // Remove acentos
        .replace(/[\s_]+/g, '-') // Substitui espaços e underscores por hífen
        .replace(/[^\w\-]+/g, '') // Remove caracteres não alfanuméricos
        .replace(/\-\-+/g, '-'); // Substitui múltiplos hífens por um único
}
