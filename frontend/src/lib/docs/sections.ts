// Seções da documentação, na ordem em que aparecem no menu.
// Cada seção corresponde a uma pasta em src/content/docs/<id>/.
export interface DocSection {
    id: string;
    title: string;
    description: string;
}

export const SECTIONS: DocSection[] = [
    { id: 'comecando', title: 'Começando', description: 'O que é o Bentifiles, como entrar e como a plataforma se organiza.' },
    { id: 'pedir', title: 'Para quem pede documentos', description: 'Crie projetos, defina o que pedir, convide pessoas e revise os envios.' },
    { id: 'enviar', title: 'Para quem envia documentos', description: 'Aceite um convite, envie seus arquivos e saiba o que fazer se algo for recusado.' },
    { id: 'conta', title: 'Conta e assinatura', description: 'Perfil, planos, licenças da equipe e programa de afiliados.' },
    { id: 'ajuda', title: 'Ajuda', description: 'Perguntas frequentes e solução de problemas.' },
];
