import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Copy, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface InvitationGeneratorProps {
  mentorId: string;
  products: Array<{ id: string; name: string }>;
  onInvitationGenerated?: (invitation: any) => void;
}

const invitationSchema = z.object({
  product_id: z.string().min(1, 'Product is required'),
  invited_name: z.string().optional(),
  invited_email: z.string().email('Invalid email').optional().or(z.literal('')),
  expiration_days: z.coerce.number().min(1).max(365).default(30),
});

type InvitationFormValues = z.infer<typeof invitationSchema>;

export const InvitationGenerator: React.FC<InvitationGeneratorProps> = ({
  mentorId,
  products,
  onInvitationGenerated,
}) => {
  const [loading, setLoading] = useState(false);
  const [generatedInvitation, setGeneratedInvitation] = useState<any | null>(null);
  const [copied, setCopied] = useState(false);

  const form = useForm<InvitationFormValues>({
    resolver: zodResolver(invitationSchema),
    defaultValues: {
      product_id: '',
      invited_name: '',
      invited_email: '',
      expiration_days: 30,
    },
  });

  const onSubmit = async (values: InvitationFormValues) => {
    try {
      setLoading(true);
      const response = await fetch('/api/invitations/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('mentor_token')}`,
        },
        body: JSON.stringify({
          product_id: values.product_id,
          invited_name: values.invited_name || undefined,
          invited_email: values.invited_email || undefined,
          expiration_days: values.expiration_days,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate invitation');
      }

      const data = await response.json();
      setGeneratedInvitation(data.data);
      toast.success('Invitation generated successfully');

      if (onInvitationGenerated) {
        onInvitationGenerated(data.data);
      }

      form.reset();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate invitation';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = () => {
    if (generatedInvitation?.invite_link) {
      navigator.clipboard.writeText(generatedInvitation.invite_link);
      setCopied(true);
      toast.success('Link copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (generatedInvitation) {
    return (
      <Card className="w-full max-w-2xl">
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="flex items-center justify-center">
              <CheckCircle2 className="h-12 w-12 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-center">Invitation Generated!</h2>
            <p className="text-center text-gray-600">
              Share this link with your student to get them started.
            </p>

            <div className="rounded-lg bg-gray-50 p-4 space-y-3">
              <div>
                <p className="text-sm text-gray-600 mb-1">Invitation Link</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-white p-3 rounded border text-sm break-all">
                    {generatedInvitation.invite_link}
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyLink}
                  >
                    {copied ? (
                      <>
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="mr-2 h-4 w-4" />
                        Copy
                      </>
                    )}
                  </Button>
                </div>
              </div>

              <div>
                <p className="text-sm text-gray-600 mb-1">Invite Code</p>
                <code className="bg-white p-3 rounded border text-sm font-mono">
                  {generatedInvitation.invite_code}
                </code>
              </div>

              <div>
                <p className="text-sm text-gray-600 mb-1">Expires At</p>
                <p className="font-semibold">
                  {new Date(generatedInvitation.expires_at).toLocaleDateString('pt-BR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              </div>

              {generatedInvitation.invited_email && (
                <div>
                  <p className="text-sm text-gray-600 mb-1">Invited Email</p>
                  <p className="font-semibold">{generatedInvitation.invited_email}</p>
                </div>
              )}
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Your student will need to complete the registration and payment before getting access.
              </AlertDescription>
            </Alert>

            <Button
              onClick={() => setGeneratedInvitation(null)}
              variant="outline"
              className="w-full"
            >
              Generate Another Invitation
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>Generate Student Invitation</CardTitle>
        <CardDescription>
          Create an invitation link to send to your student
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="product_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Select Course</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a course" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {products.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="invited_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Student Name (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="John Doe" {...field} />
                  </FormControl>
                  <FormDescription>
                    Name of the student you're inviting
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="invited_email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Student Email (Optional)</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="student@example.com"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Email of the student (for your records)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="expiration_days"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Expiration (days)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="1"
                      max="365"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    How long the invitation link remains valid
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              disabled={loading}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                'Generate Invitation Link'
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};

export default InvitationGenerator;
