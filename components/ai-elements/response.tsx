'use client';

import { cn } from '@/lib/utils';
import React, { memo } from 'react';
import { Streamdown } from 'streamdown';

type ResponseProps = React.ComponentProps<typeof Streamdown>;

const ResponseComponent = ({ className, ...props }: ResponseProps) => (
  <Streamdown
    className={cn(
      'size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0',
      className
    )}
    {...props}
  />
);

ResponseComponent.displayName = 'Response';

export const Response = memo(ResponseComponent);
