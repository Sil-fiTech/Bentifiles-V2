import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkUser(email: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      console.log('Usuário não encontrado');
      return;
    }

    console.log('Status do Usuário:', {
      email: user.email,
      stripeCustomerId: user.stripeCustomerId,
      stripeSubscriptionId: user.stripeSubscriptionId,
      subscriptionStatus: user.subscriptionStatus,
      subscriptionPlan: user.subscriptionPlan,
      subscriptionTrialEndsAt: user.subscriptionTrialEndsAt,
      hasSystemAccess: user.hasSystemAccess,
      hasSelectedPlan: user.hasSelectedPlan,
    });
    
    // Check if he would have access
    const now = new Date();
    const canCreate = user.subscriptionStatus === 'ACTIVE' || 
                    (user.subscriptionStatus === 'TRIALING' && user.subscriptionTrialEndsAt && user.subscriptionTrialEndsAt > now);
    
    console.log('Pode criar projetos (Calculado):', !!canCreate);
    if (!canCreate && user.subscriptionStatus === 'TRIALING') {
        console.log('Motivo do bloqueio Trial:', {
            trialEndsAt: user.subscriptionTrialEndsAt,
            now: now,
            isExpired: user.subscriptionTrialEndsAt ? user.subscriptionTrialEndsAt <= now : 'No date'
        });
    }

  } catch (error) {
    console.error('Erro ao verificar usuário:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Get email from command line or replace with target user email
const email = process.argv[2];
if (!email) {
    console.log('Por favor, forneça um email: ts-node checkUser.ts <email>');
} else {
    checkUser(email);
}
