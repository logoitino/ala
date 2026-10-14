/**
 * Routes the Books desk (BOOKS-01) into the main admin: bookkeeping, tax-year pack and accounting
 * exports. The enclosing admin shell gates access; the desk's own reads require an admin profile.
 */
import { BooksScreen } from '@/components/Admin/Books/BooksScreen';

export default function AdminBooksRoute() {
  return <BooksScreen />;
}
