"""Cold-start initialization regression checks, isolated to avoid hanging the test runner."""
import subprocess
import sys
import textwrap
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class TestTranslationInitialization(unittest.TestCase):
    def run_child(self, code):
        try:
            result = subprocess.run([sys.executable, '-c', textwrap.dedent(code)],
                                    cwd=ROOT, capture_output=True, text=True, timeout=20)
        except subprocess.TimeoutExpired:
            self.fail('TranslationService cold initialization deadlocked (child timed out).')
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_import_and_empty_translation_remain_lazy(self):
        self.run_child('''
            import sys
            from backend.services import translation_service as service
            assert service._argos_module is None
            assert not service.TranslationService._is_initialized
            assert 'argostranslate' not in sys.modules
            assert service.TranslationService.translate('   ', 'vi', 'en') == ''
            assert 'argostranslate' not in sys.modules
        ''')

    def test_concurrent_cold_initialization_runs_once_and_installs_sentencizer(self):
        self.run_child('''
            import sys
            import threading
            import types
            from concurrent.futures import ThreadPoolExecutor
            from backend.services import translation_service as service

            # Stub only the heavy dependency, retaining the real import and lock paths.
            argos = types.ModuleType('argostranslate')
            argos.__path__ = []
            for name in ('package', 'translate', 'sbd'):
                child = types.ModuleType('argostranslate.' + name)
                setattr(argos, name, child)
                sys.modules[child.__name__] = child
            sys.modules['argostranslate'] = argos
            underlying = types.SimpleNamespace(sentencizer=None)
            translation = types.SimpleNamespace(sentencizer=None, underlying=underlying)
            language = types.SimpleNamespace(translations_from=[translation])
            init_calls = []
            def installed():
                init_calls.append(1)
                return [language]
            argos.translate.get_installed_languages = installed

            gate = threading.Barrier(12)
            def worker(_):
                gate.wait()
                service.TranslationService._ensure_initialized()
                return service._get_argos()
            with ThreadPoolExecutor(max_workers=12) as pool:
                modules = list(pool.map(worker, range(12)))
            assert len(init_calls) == 1, init_calls
            assert all(module is argos for module in modules)
            assert service.TranslationService._is_initialized
            assert isinstance(translation.sentencizer, service.OfflinePromptSentencizer)
            assert underlying.sentencizer is translation.sentencizer
            service.TranslationService._ensure_initialized()
            assert len(init_calls) == 1
        ''')
