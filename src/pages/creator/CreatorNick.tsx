import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useSettingsStore } from "../../store/settings";

const CreatorNick = () => {
  const { t } = useTranslation();
  const [formNick, setFormNick] = useState("");

  const setNick = useSettingsStore((state) => state.setNick);
  const setCreatorStep = useSettingsStore((state) => state.setCreatorStep);

  const onClick = () => {
    if (formNick.length !== 0) {
      setNick(formNick);
      setCreatorStep(2);
    }
  };

  return (
    <div className="md:container md:mx-auto py-14 antialiased md:max-w-lg">
      <div className="flex flex-col h-[70vh] items-center shadow-lg">
        <div className="grow"></div>
        <div className="flex-1">
          <p className="text-2xl font-bold">{t("creator.nick.title")}</p>
        </div>
        <div className="flex-1">
          <label className="block">
            <span className="text-slate-700">{t("creator.nick.nick")}</span>
            <input
              onChange={(e) => setFormNick(e.target.value)}
              className="form-input mt-0 block w-full px-0.5 border-0 border-b-2 border-gray-200 focus:ring-0 focus:border-black"
              type="text"
              placeholder=""
              required
            />
          </label>
        </div>
        <div className="flex-1 justify-end">
          <button
            className="px-4 py-2 font-semibold text-sm bg-white dark:bg-slate-700 text-slate-700 dark:text-white border border-slate-300 dark:border-slate-600 hover:border-indigo-300 dark:hover:border-slate-400 rounded-md shadow-sm"
            type="button"
            onClick={onClick}
          >
            {t("creator.nick.button.next")}
          </button>
        </div>
        <div className="grow"></div>
      </div>
    </div>
  );
};

export default CreatorNick;
