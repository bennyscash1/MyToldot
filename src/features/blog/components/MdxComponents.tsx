import { cn } from '@/lib/utils';
import { BlogGallery } from './BlogGallery';
import { BlogImage } from './BlogImage';
import { FadeUp } from './FadeUp';

export function getMdxComponents() {
  return {
    BlogImage,
    BlogGallery,
    FadeUp,
    h1: ({ className, ...props }: React.ComponentPropsWithoutRef<'h1'>) => (
      <h1
        className={cn('mt-10 font-serif text-3xl font-bold leading-tight tracking-tight text-slate-900 sm:text-4xl', className)}
        {...props}
      />
    ),
    h2: ({ className, ...props }: React.ComponentPropsWithoutRef<'h2'>) => (
      <h2
        className={cn('mt-10 font-serif text-2xl font-semibold leading-snug tracking-tight text-slate-900 sm:text-3xl', className)}
        {...props}
      />
    ),
    h3: ({ className, ...props }: React.ComponentPropsWithoutRef<'h3'>) => (
      <h3
        className={cn('mt-8 font-serif text-xl font-semibold leading-snug text-slate-900 sm:text-2xl', className)}
        {...props}
      />
    ),
    p: ({ className, ...props }: React.ComponentPropsWithoutRef<'p'>) => (
      <p className={cn('mt-5 text-base leading-[1.9] text-slate-700 sm:text-lg', className)} {...props} />
    ),
    a: ({ className, ...props }: React.ComponentPropsWithoutRef<'a'>) => (
      <a
        className={cn(
          'font-medium text-emerald-700 underline decoration-emerald-300 underline-offset-4 transition-colors hover:text-emerald-800',
          className,
        )}
        {...props}
      />
    ),
    ul: ({ className, ...props }: React.ComponentPropsWithoutRef<'ul'>) => (
      <ul className={cn('mt-5 list-disc space-y-2 ps-6 text-base leading-[1.9] text-slate-700 sm:text-lg', className)} {...props} />
    ),
    ol: ({ className, ...props }: React.ComponentPropsWithoutRef<'ol'>) => (
      <ol className={cn('mt-5 list-decimal space-y-2 ps-6 text-base leading-[1.9] text-slate-700 sm:text-lg', className)} {...props} />
    ),
    li: ({ className, ...props }: React.ComponentPropsWithoutRef<'li'>) => (
      <li className={cn('ps-1', className)} {...props} />
    ),
    blockquote: ({ className, ...props }: React.ComponentPropsWithoutRef<'blockquote'>) => (
      <blockquote
        className={cn(
          'my-8 rounded-2xl border-s-4 border-emerald-500 bg-emerald-50/70 px-5 py-4 text-base leading-[1.9] text-slate-700 sm:text-lg',
          className,
        )}
        {...props}
      />
    ),
    hr: ({ className, ...props }: React.ComponentPropsWithoutRef<'hr'>) => (
      <hr className={cn('my-10 border-slate-200', className)} {...props} />
    ),
    strong: ({ className, ...props }: React.ComponentPropsWithoutRef<'strong'>) => (
      <strong className={cn('font-semibold text-slate-900', className)} {...props} />
    ),
    code: ({ className, ...props }: React.ComponentPropsWithoutRef<'code'>) => (
      <code
        className={cn(
          'rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[0.9em] text-slate-800',
          className,
        )}
        {...props}
      />
    ),
    pre: ({ className, ...props }: React.ComponentPropsWithoutRef<'pre'>) => (
      <pre
        className={cn(
          'my-6 overflow-x-auto rounded-2xl bg-slate-950 px-4 py-4 text-sm leading-7 text-slate-100',
          className,
        )}
        {...props}
      />
    ),
  };
}
