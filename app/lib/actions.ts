'use server'
import { z } from 'zod'
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import postgres from 'postgres';
import { signIn } from '@/auth';
import { AuthError } from 'next-auth';

export type State = {
    errors?: {
        customerId?: string[];
        amount?: string[];
        status?: string[];
    };
    message?: string | null;
};

const sql = postgres(process.env.POSTGRES_URL!, { ssl: 'require' });

const FormSchema = z.object({
    id: z.string(),
    customerId: z.string({
        invalid_type_error: 'Please select a customer.'
    }),
    amount: z.coerce.number().gt(0, { message: 'Please an amount greater than $0' }),
    status: z.enum(['pending', 'paid'], {
        invalid_type_error: 'Please select an invoice status'
    }),
    date: z.string()
});

const CreateInvoce = FormSchema.omit({ id: true, date: true });

export async function createInvoce(prevState: State, formData: FormData) {
    const validatedFields = CreateInvoce.safeParse({
        customerId: formData.get('customerId'),
        amount: formData.get('amount'),
        status: formData.get('status'),
    });

    if (!validatedFields.success) {
        return {
            errors: validatedFields.error.flatten().fieldErrors,
            message: 'Missing Fields. Failed to Create Invoice.',
        };
    }
    const { customerId, amount, status } = validatedFields.data;
    const amountInCents = amount * 100;
    const date = new Date().toISOString().split('T')[0];

    try {
        await sql`
            insert into invoices (customer_id, amount, status, date)
            values (${customerId}, ${amountInCents}, ${status}, ${date})
        `;
    } catch (error) {
        console.error(error);
    }

    revalidatePath('/dashboard/invoices');
    redirect('/dashboard/invoices');
}

const UpdateInvoice = FormSchema.omit({ id: true, date: true });

export async function updateInvoice(id: string, prevState: State, formData: FormData) {
    const validatedFields = UpdateInvoice.safeParse({
        customerId: formData.get('customerId'),
        amount: formData.get('amount'),
        status: formData.get('status'),
    });

    if (!validatedFields.success) {
        return {
            errors: validatedFields.error.flatten().fieldErrors,
            message: 'Missing Fields. Failed to Create Invoice.',
        };
    }

    const { customerId, amount, status } = validatedFields.data;
    const amountInCents = amount * 100;

    try {
        await sql`
            update invoices 
            set customer_id = ${customerId}, amount = ${amountInCents}, status = ${status}
            where id = ${id}
        `;
    } catch (error) {
        console.error(error);
    }
    revalidatePath('/dashboard/invoices');
    redirect('/dashboard/invoices');
}

export async function deleteInvoice(id: string) {
    throw new Error('Failed to Delete Invoice');

    // Unreachable code block
    await sql`DELETE FROM invoices WHERE id = ${id}`;
    revalidatePath('/dashboard/invoices');
}

export async function authenticate(
    prevState: string | undefined,
    formData: FormData,
) {
    try {
        await signIn('credentials', formData);
    } catch (error) {
        if (error instanceof AuthError) {
            switch (error.type) {
                case 'CredentialsSignin':
                    return 'Invalid credentials.';
                default:
                    return 'Something went wrong.';
            }
        }
        throw error;
    }
}