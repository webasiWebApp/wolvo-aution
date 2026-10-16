import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuction } from '@/lib/auctionQueries';
import { useTransaction } from '@/lib/transactionQueries';
import { useAuth } from '@/lib/AuthContext';
import CheckoutPanel from '@/components/payments/CheckoutPanel';
import CollectionPanel from '@/components/transactions/CollectionPanel';
import DisputePanel from '@/components/transactions/DisputePanel';
import ReviewPanel from '@/components/transactions/ReviewPanel';
import { Loader2, ArrowLeft } from 'lucide-react';

export default function TransactionDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { data: tx, isLoading } = useTransaction(id);
  const { data: auction } = useAuction(tx?.auction_id);

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  if (!tx) return <div className="mx-auto max-w-2xl px-4 py-20 text-center"><p className="text-muted-foreground">Transaction not found.</p><Link to="/my-transactions" className="text-primary underline">Back</Link></div>;

  const role = {
    isBuyer: tx.buyer_id === user?.id,
    isSeller: tx.seller_id === user?.id,
    isAdmin: user?.role === 'admin',
    // Staff can confirm manual payments; the backend also checks auction assignment.
    isStaff: user?.role === 'admin' || user?.role === 'auctioneer'
  };
  if (!role.isBuyer && !role.isSeller && !role.isAdmin) {
    return <div className="mx-auto max-w-2xl px-4 py-20 text-center"><p className="text-muted-foreground">You are not authorised to view this transaction.</p></div>;
  }

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-6">
      <Link to="/my-transactions" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4"><ArrowLeft className="h-4 w-4" /> Back to transactions</Link>
      <h1 className="text-2xl font-bold text-foreground">{auction?.title || 'Transaction'}</h1>
      <p className="text-sm text-muted-foreground mb-1">Transaction #{tx.id.slice(-8).toUpperCase()}</p>
      <p className="text-sm text-muted-foreground mb-5">You are the {role.isSeller ? 'seller' : role.isBuyer ? 'buyer' : 'admin'}.</p>
      <div className="grid gap-5">
        <CheckoutPanel tx={tx} role={role} />
        <CollectionPanel tx={tx} role={role} />
        <DisputePanel tx={tx} role={role} />
        <ReviewPanel tx={tx} role={role} />
      </div>
    </div>
  );
}