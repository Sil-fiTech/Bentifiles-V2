import { PrismaClient } from '@prisma/client';
import { generateSlug } from '../src/utils/slugify';

const prisma = new PrismaClient();

const defaultDocumentTypes = [
    'RG',
    'CPF',
    'CNH',
    'Comprovante de Residência',
    'Cartão CNPJ',
    'Contrato Social',
    'Holerite',
    'Extrato Bancário',
    'Comprovante de Renda',
    'Procuração'
];

async function main() {
    console.log('Seeding default document types...');

    for (const name of defaultDocumentTypes) {
        const slug = generateSlug(name);
        
        const existing = await prisma.documentType.findFirst({
            where: {
                slug: slug,
                tenantId: null
            }
        });

        if (!existing) {
            await prisma.documentType.create({
                data: {
                    name,
                    slug,
                    isDefault: true,
                    tenantId: null,
                    createdById: null
                }
            });
            console.log(`Created default document: ${name}`);
        } else {
            // Se precisar atualizar, pode fazer aqui
            await prisma.documentType.update({
                where: { id: existing.id },
                data: { name, isDefault: true, deletedAt: null }
            });
            console.log(`Updated default document: ${name}`);
        }
    }

    console.log('Seeding finished.');
}

main()
    .catch((e) => {
        console.error(e);
        // @ts-ignore
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
