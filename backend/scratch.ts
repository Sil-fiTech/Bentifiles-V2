import dotenv from 'dotenv';
import Stripe from 'stripe';
import { PrismaClient } from '@prisma/client';

dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2026-03-25.dahlia' as any,
});
const prisma = new PrismaClient();

async function run() {
   const users = await prisma.user.findMany({ where: { stripeCustomerId: { not: null } }});
   if (users.length > 0 && users[0].stripeCustomerId) {
       console.log("Customer:", users[0].stripeCustomerId);
       try {
           const preview = await (stripe.invoices as any).createPreview({ customer: users[0].stripeCustomerId });
           console.log("Amount Due:", preview.amount_due);
       } catch (e: any) {
           console.log("Failed:", e.message);
       }
   }
}

run().catch(console.error);
