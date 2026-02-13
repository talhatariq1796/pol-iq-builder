import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { LocalChatMessage } from "@/types/index";
import { Copy, Check } from 'lucide-react';

interface MessageDialogProps {
  message: LocalChatMessage | null;
  onClose: () => void;
}

const MessageDialog: React.FC<MessageDialogProps> = ({ message, onClose }) => {
  const [copied, setCopied] = React.useState(false);

  if (!message) return null;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={!!message} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto bg-white rounded-xl shadow-lg">
        <DialogHeader className="border-b pb-4">
          <DialogTitle className="text-xs font-bold">Analysis Details</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <pre className="whitespace-pre-wrap text-xs text-gray-700 font-sans">
            {message.content}
          </pre>
        </div>
        <DialogFooter className="flex justify-between gap-3">
          <Button
            variant="outline"
            onClick={copyToClipboard}
            className="flex items-center gap-2"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4" /> Copied
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" /> Copy Content
              </>
            )}
          </Button>
          <Button
            onClick={onClose}
            className="bg-[#33a852] hover:bg-[#2d9748] text-white"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MessageDialog;
