import { Zhipu } from '@lobehub/icons';
import { Form, type ItemGroup } from '@lobehub/ui';
import { Form as AntForm, Input, Switch } from 'antd';
import { useTheme } from 'antd-style';
import { debounce } from 'lodash-es';
import { lighten } from 'polished';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Flexbox } from 'react-layout-kit';

import { FORM_STYLE } from '@/const/layoutTokens';
import { ModelProvider } from '@/libs/agent-runtime';
import { useEffectAfterGlobalHydrated, useGlobalStore } from '@/store/global';
import { modelProviderSelectors, settingsSelectors } from '@/store/global/selectors';

import Checker from '../Checker';

const configKey = 'languageModel';

const LLM = memo(() => {
  const { t } = useTranslation('setting');
  const [form] = AntForm.useForm();
  const theme = useTheme();
  const [enabledZhipu, setSettings] = useGlobalStore((s) => [
    modelProviderSelectors.enableZhipu(s),
    s.setSettings,
  ]);

  useEffectAfterGlobalHydrated((store) => {
    const settings = settingsSelectors.currentSettings(store.getState());

    form.setFieldsValue(settings);
  }, []);

  const model: ItemGroup = {
    children: [
      {
        children: (
          <Input.Password
            autoComplete={'new-password'}
            placeholder={t('llm.Zhipu.token.placeholder')}
          />
        ),
        desc: t('llm.Zhipu.token.desc'),
        label: t('llm.Zhipu.token.title'),
        name: [configKey, 'zhipu', 'ZHIPU_API_KEY'],
      },
      {
        children: <Checker model={'glm-3-turbo'} provider={ModelProvider.ZhiPu} />,
        desc: t('llm.checker.desc'),
        label: t('llm.checker.title'),
        minWidth: undefined,
      },
    ],
    defaultActive: enabledZhipu,
    extra: (
      <Switch
        onChange={(enabled) => {
          setSettings({ languageModel: { zhipu: { enabled } } });
        }}
        value={enabledZhipu}
      />
    ),
    title: (
      <Flexbox align={'center'} gap={8} horizontal>
        <Zhipu.Combine
          color={theme.isDarkMode ? lighten(0.1, Zhipu.colorPrimary) : Zhipu.colorPrimary}
          size={32}
        />
      </Flexbox>
    ),
  };

  return (
    <Form form={form} items={[model]} onValuesChange={debounce(setSettings, 100)} {...FORM_STYLE} />
  );
});

export default LLM;
