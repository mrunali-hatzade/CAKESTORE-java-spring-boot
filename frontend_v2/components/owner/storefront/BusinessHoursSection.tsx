import React, { useState } from 'react';
import { Calendar, Clock, Moon } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { ShopBusinessHour, ShopBusinessHoursRequest } from '@/types/storefrontManagement';
import { ownerStorefrontApi } from '@/lib/api/ownerStorefront';

const DAYS = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
];

interface BusinessHoursSectionProps {
  hours: ShopBusinessHour[];
  onHoursChange: (hours: ShopBusinessHour[]) => void;
}

export const BusinessHoursSection: React.FC<BusinessHoursSectionProps> = ({
  hours,
  onHoursChange,
}) => {
  const [savingDay, setSavingDay] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ day: string; msg: string; type: 'success' | 'error' } | null>(null);

  const getDayHour = (day: string): ShopBusinessHour => {
    const existing = hours.find((h) => h.dayOfWeek.toUpperCase() === day.toUpperCase());
    if (existing) return existing;
    return {
      dayOfWeek: day,
      isOpen: day !== 'SUNDAY',
      openTime: '09:00:00',
      closeTime: '21:00:00',
    };
  };

  const handleUpdate = async (day: string, isOpen: boolean, openTime: string, closeTime: string) => {
    if (isOpen && openTime === closeTime) {
      setFeedback({ day, msg: 'Opening and closing times cannot be identical', type: 'error' });
      return;
    }

    setSavingDay(day);
    setFeedback(null);

    const payload: ShopBusinessHoursRequest = {
      dayOfWeek: day,
      isOpen,
      openTime: openTime.length === 5 ? openTime + ':00' : openTime,
      closeTime: closeTime.length === 5 ? closeTime + ':00' : closeTime,
    };

    try {
      const saved = await ownerStorefrontApi.saveBusinessHour(payload);
      const updatedList = hours.filter((h) => h.dayOfWeek.toUpperCase() !== day.toUpperCase());
      onHoursChange([...updatedList, saved]);
      setFeedback({ day, msg: 'Saved', type: 'success' });
      setTimeout(() => setFeedback(null), 2500);
    } catch (err: any) {
      setFeedback({ day, msg: err?.message || 'Failed to save', type: 'error' });
    } finally {
      setSavingDay(null);
    }
  };

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-xl bg-brand-blush text-brand-plum flex items-center justify-center">
          <Calendar className="w-4 h-4" />
        </div>
        <div>
          <h2 className="font-serif font-bold text-base text-owner-heading">Operating & Baking Schedule</h2>
          <p className="text-[11px] text-owner-muted">
            Manage your opening and closing times across all seven days of the week, including overnight baking shifts.
          </p>
        </div>
      </div>

      <div className="space-y-2.5 pt-1">
        {DAYS.map((day) => {
          const entry = getDayHour(day);
          const isCurrentSaving = savingDay === day;
          const openShort = (entry.openTime || '09:00').substring(0, 5);
          const closeShort = (entry.closeTime || '21:00').substring(0, 5);
          const isOvernight = entry.isOpen && openShort > closeShort;

          return (
            <div
              key={day}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl border border-brand-border/60 bg-white"
            >
              {/* Day Label & Toggle */}
              <div className="flex items-center gap-3 min-w-[150px]">
                <button
                  type="button"
                  onClick={() => handleUpdate(day, !entry.isOpen, openShort, closeShort)}
                  className={`w-10 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer ${
                    entry.isOpen ? 'bg-emerald-600 justify-end' : 'bg-gray-300 justify-start'
                  }`}
                >
                  <div className="bg-white w-4 h-4 rounded-full shadow-md transform transition-transform" />
                </button>
                <span className="text-xs font-bold text-owner-heading capitalize">
                  {day.toLowerCase()}
                </span>
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    entry.isOpen ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {entry.isOpen ? 'Open' : 'Closed'}
                </span>
              </div>

              {/* Time Pickers */}
              {entry.isOpen ? (
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-brand-muted" />
                    <input
                      type="time"
                      value={openShort}
                      onChange={(e) => handleUpdate(day, true, e.target.value, closeShort)}
                      className="px-2.5 py-1 text-xs rounded-lg border border-owner-border bg-white text-owner-heading focus:outline-none focus:ring-1 focus:ring-brand-plum"
                    />
                  </div>
                  <span className="text-owner-muted font-bold">&rarr;</span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="time"
                      value={closeShort}
                      onChange={(e) => handleUpdate(day, true, openShort, e.target.value)}
                      className="px-2.5 py-1 text-xs rounded-lg border border-owner-border bg-white text-owner-heading focus:outline-none focus:ring-1 focus:ring-brand-plum"
                    />
                  </div>
                  {isOvernight && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                      <Moon className="w-2.5 h-2.5" /> Overnight (+1 day)
                    </span>
                  )}
                </div>
              ) : (
                <span className="text-xs text-owner-muted italic">Bakery closed to customers</span>
              )}

              {/* Feedback indicator */}
              <div className="min-w-[70px] text-right">
                {isCurrentSaving ? (
                  <span className="text-[10px] text-brand-plum animate-pulse font-semibold">Saving...</span>
                ) : feedback?.day === day ? (
                  <span
                    className={`text-[10px] font-bold ${
                      feedback.type === 'success' ? 'text-emerald-600' : 'text-red-500'
                    }`}
                  >
                    {feedback.msg}
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
};
